# دليل النشر — Bayan ERP

دليل تشغيل النظام في بيئة إنتاج حقيقية للعميل.

---

## 1. المتطلبات

- خادم Linux (2 vCPU / 4 GB RAM حدّ أدنى؛ 4 vCPU / 8 GB مستحسن).
- Docker + Docker Compose v2.
- نطاق (domain) يشير إلى IP الخادم (سجل A).
- منافذ مفتوحة: 80 و 443 (Caddy). لا تُفتح 3000/3001 للخارج.

---

## 2. الإعداد

```bash
git clone <repo> bayan && cd bayan
cp .env.example .env
```

حرّر `.env` واضبط **كل** ما يلي:

| المتغير | ملاحظة |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 16 حرف عشوائي على الأقل — الإقلاع يفشل بدونه |
| `BACKUP_ENCRYPTION_KEY` | 64 hex — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `POSTGRES_PASSWORD` / `MINIO_ROOT_PASSWORD` | غيّرها عن القيم الافتراضية |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | اعتمادات تخزين غير افتراضية (الـ API يرفض `minioadmin` في الإنتاج) |
| `GLOBAL_ADMIN_PASSWORD` / `ADMIN_PASSWORD` / `REP_PASSWORD` | كلمات مرور البذر الأولى (8+ أحرف) |
| `DOMAIN` | مثال: `app.bayan.example` |
| `ACME_EMAIL` | بريد لتنبيهات شهادة TLS |
| `CORS_ORIGINS` | `https://app.bayan.example` |
| `NEXT_PUBLIC_API_URL` | `https://app.bayan.example/api` |

> توليد سر قوي: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

---

## 3. التشغيل

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile apps up -d --build
```

يُنفّذ التسلسل تلقائياً:
1. تشغيل `postgres` + `redis` + `minio` والتحقق من صحتها.
2. `api-migrate` يطبّق كل ترحيلات Prisma (يفشل التشغيل إن بقيت ترحيلات معلّقة).
3. `minio-init` ينشئ مستخدماً مخصّصاً و bucket.
4. `api` ثم `web` بعد اجتياز فحوص الصحة.
5. `caddy` ينشئ شهادة TLS ويوجّه `/api` → api والباقي → web.

التحقق:

```bash
curl -fsS https://app.bayan.example/api/health
curl -fsSI https://app.bayan.example/
```

---

## 4. بذر البيانات الأولي (مرة واحدة)

```bash
docker compose exec api pnpm exec tsx prisma/seed.ts
```

> في الإنتاج يفشل البذر إن لم تُضبط `GLOBAL_ADMIN_PASSWORD` / `ADMIN_PASSWORD` /
> `REP_PASSWORD` — لا يستخدم قيماً افتراضية ضعيفة.

---

## 5. تدوير بيانات الدخول عند التسليم

لمشاركة بيانات دخول العميل، دوّرها عبر سكربت التدوير ثم سلّم القيم:

```bash
# المشرف العام
docker compose exec -e GLOBAL_ADMIN_PASSWORD='...' api pnpm run db:rotate

# مستخدم شركة
docker compose exec -e USER_EMAIL='owner@client.example' -e USER_PASSWORD='...' api pnpm run db:rotate
```

> لا تعدّل كلمات المرور في قاعدة البيانات يدوياً — استخدم السكربت (تجزئة bcrypt صحيحة).

---

## 6. النسخ الاحتياطي

- نسخ احتياطي يومي مجدول تلقائياً (افتراضياً 02:00، يُضبط بـ `BACKUP_DAILY_TIME`)،
  مشفّر بمفتاح `BACKUP_ENCRYPTION_KEY`.
- التحقق اليدوي: من واجهة **النسخ الاحتياطية** في اللوحة، أو:
  ```bash
  docker compose exec api pnpm run bench   # ملاحظة: bench للأداء، راجع واجهة النسخ للنسخ الفعلية
  ```
- **تمرين استرجاع** دوري: نزّل نسخة، وفكّها، واسترجعها على قاعدة اختبارية.
  اختبر التمرين قبل التسليم باستخدام واجحة «النسخ الاحتياطية» (زر التحقق/الاسترجاع).

---

## 7. المراقبة والصيانة

```bash
docker compose ps                 # حالة الخدمات
docker compose logs -f api        # سجلات API
docker compose logs -f caddy      # سجلات الوصول/TLS
docker compose pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile apps up -d --build   # تحديث
```

- سجلات الوصول في وحدة `caddydata` (`/data/access.log`).
- تحقق من تجديد شهادة TLS تلقائياً (Caddy).
- راقب نمو حجم `pgdata` وخطط لأرشفة السجلات.

---

## 8. الأمان — قائمة تحقق التسليم

- [ ] `JWT_SECRET` و `BACKUP_ENCRYPTION_KEY` قيمتان قويتان فريدتان.
- [ ] `POSTGRES_PASSWORD` و `MINIO_ROOT_PASSWORD` و `S3_*` ليست افتراضية.
- [ ] كلمات مرور البذر دوّرت عبر `db:rotate` ولم تُشارك القيم الافتراضية.
- [ ] لم يُشارك `root`/`admin123` مع العميل.
- [ ] `CORS_ORIGINS` محدد بنطاق الإنتاج فقط.
- [ ] 3000/3001 غير مفتوحة للإنترنت (فقط Caddy على 80/443).
- [ ] Swagger غير مكشوف (`NODE_ENV=production`، بدون `ENABLE_SWAGGER`).
- [ ] تمرين استرجاع نسخة احتياطية نُفّذ بنجاح.
- [ ] نسخة احتياطية حديثة موجودة خارج الخادم.

---

## 9. الإشعارات الفورية (اختياري)

بدون اعتمادات FCM يعمل النقل في وضع `no-op` (الإشعارات داخل التطبيق تعمل).
لتفعيل الدفع للأجهزة اضبط `FCM_SERVICE_ACCOUNT` (JSON) أو `FCM_SERVICE_ACCOUNT_FILE`
مع `FCM_PROJECT_ID`، ثم أعد تشغيل الـ API.
