import { Logger } from '@nestjs/common';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { INVALID_TOKEN_ERRORS, type PushMessage, type PushProvider, type PushResult } from './push.js';

export interface FcmEnv {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

interface ServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function loadServiceAccount(): ServiceAccount | null {
  const inline = process.env.FCM_SERVICE_ACCOUNT;
  const file = process.env.FCM_SERVICE_ACCOUNT_FILE;
  try {
    if (inline && inline.trim()) return JSON.parse(inline) as ServiceAccount;
    if (file && file.trim()) return JSON.parse(readFileSync(file, 'utf8')) as ServiceAccount;
  } catch {
    return null;
  }
  return null;
}

/** يقرأ إعدادات FCM من البيئة؛ يعيد null إن غابت المفاتيح (فيُستخدم البديل الصامت). */
export function readFcmEnv(): FcmEnv | null {
  const sa = loadServiceAccount();
  const projectId = process.env.FCM_PROJECT_ID ?? sa?.project_id;
  const clientEmail = sa?.client_email;
  const privateKey = sa?.private_key?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * مزوّد FCM HTTP v1 (§5.15). يبني OAuth2 access token من حساب خدمة
 * (JWT موقّع RS256 ثم مقايضته عند Google) ويخزّنه حتى قرب انتهائه.
 * لا يعتمد على أي مكتبة خارجية — `node:crypto` + `fetch`.
 */
export class FcmPushProvider implements PushProvider {
  readonly driver = 'fcm' as const;
  private readonly logger = new Logger('FcmPushProvider');
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(private readonly env: FcmEnv) {}

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.expiresAt - 60 > now) return this.accessToken;

    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: this.env.clientEmail,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signingInput = `${header}.${claims}`;
    const signature = base64url(createSign('RSA-SHA256').update(signingInput).sign(this.env.privateKey));
    const assertion = `${signingInput}.${signature}`;

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) {
      throw new Error(`FCM token exchange failed: ${res.status}`);
    }
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = body.access_token;
    this.expiresAt = now + (body.expires_in ?? 3600);
    return this.accessToken;
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${this.env.projectId}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: message.token,
            notification: { title: message.title, ...(message.body ? { body: message.body } : {}) },
            ...(message.data ? { data: message.data } : {}),
          },
        }),
      });
      const text = await res.text();
      if (res.ok) {
        let messageId: string | undefined;
        try {
          messageId = (JSON.parse(text) as { name?: string }).name;
        } catch {
          /* ignore */
        }
        return { token: message.token, ok: true, messageId };
      }
      return { token: message.token, ok: false, error: extractError(text, res.status), invalid: isInvalid(text) };
    } catch (err) {
      this.logger.warn(`FCM send failed: ${err instanceof Error ? err.message : String(err)}`);
      return { token: message.token, ok: false, error: err instanceof Error ? err.message : 'send failed' };
    }
  }

  async sendAll(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    // تزامن محدود حتى لا نقصف FCM عند وجود عدد كبير من الأجهزة.
    const limit = 10;
    for (let i = 0; i < messages.length; i += limit) {
      const batch = messages.slice(i, i + limit);
      results.push(...(await Promise.all(batch.map((m) => this.send(m)))));
    }
    return results;
  }
}

function extractError(body: string, status: number): string {
  try {
    const j = JSON.parse(body) as { error?: { status?: string; message?: string } };
    return j.error?.status ?? j.error?.message ?? `HTTP ${status}`;
  } catch {
    return `HTTP ${status}`;
  }
}

function isInvalid(body: string): boolean {
  const err = extractError(body, 0);
  return (INVALID_TOKEN_ERRORS as readonly string[]).includes(err) || /UNREGISTERED/i.test(body);
}
