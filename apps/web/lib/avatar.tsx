'use client';

import { useCallback, useSyncExternalStore } from 'react';

export interface PresetAvatar {
  id: string;
  name: string;
  roleHint: string;
  gradient: string;
  emoji: string;
  borderColor: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'avatar-exec-1',
    name: 'المدير التنفيذي',
    roleHint: 'إدارة عليا',
    gradient: 'from-blue-600 via-indigo-600 to-slate-900',
    emoji: '👔',
    borderColor: '#3b82f6',
  },
  {
    id: 'avatar-tech-1',
    name: 'مشرف الأنظمة',
    roleHint: 'دعم وتقنية',
    gradient: 'from-cyan-600 via-blue-600 to-indigo-900',
    emoji: '💻',
    borderColor: '#06b6d4',
  },
  {
    id: 'avatar-finance-1',
    name: 'المحاسب المالي',
    roleHint: 'حسابات وخزينة',
    gradient: 'from-emerald-600 via-teal-600 to-slate-900',
    emoji: '📊',
    borderColor: '#10b981',
  },
  {
    id: 'avatar-sales-1',
    name: 'مسؤول المبيعات',
    roleHint: 'مبيعات وتسويق',
    gradient: 'from-amber-500 via-orange-600 to-red-700',
    emoji: '📈',
    borderColor: '#f59e0b',
  },
  {
    id: 'avatar-cashier-1',
    name: 'كاشير المعرض',
    roleHint: 'نقاط بيع سريعة',
    gradient: 'from-purple-600 via-pink-600 to-slate-900',
    emoji: '⚡',
    borderColor: '#a855f7',
  },
  {
    id: 'avatar-store-1',
    name: 'أمين المستودع',
    roleHint: 'مخازن وجرد',
    gradient: 'from-teal-600 via-emerald-700 to-slate-900',
    emoji: '📦',
    borderColor: '#14b8a6',
  },
  {
    id: 'avatar-rep-1',
    name: 'مندوب خارجي',
    roleHint: 'توزيع وتوريد',
    gradient: 'from-blue-700 via-cyan-600 to-slate-900',
    emoji: '🚚',
    borderColor: '#0284c7',
  },
  {
    id: 'avatar-auditor-1',
    name: 'مراجع الحسابات',
    roleHint: 'تدقيق وأمان',
    gradient: 'from-rose-600 via-pink-600 to-purple-800',
    emoji: '🛡️',
    borderColor: '#f43f5e',
  },
  {
    id: 'avatar-purchaser-1',
    name: 'مسؤول المشتريات',
    roleHint: 'توريدات وموردون',
    gradient: 'from-amber-600 via-yellow-600 to-stone-800',
    emoji: '🏷️',
    borderColor: '#eab308',
  },
  {
    id: 'avatar-client-1',
    name: 'خدمة العملاء',
    roleHint: 'علاقات ومتابعة',
    gradient: 'from-indigo-600 via-violet-600 to-pink-700',
    emoji: '🤝',
    borderColor: '#8b5cf6',
  },
  {
    id: 'avatar-star-1',
    name: 'نجم التميز',
    roleHint: 'عضو متميز',
    gradient: 'from-yellow-500 via-amber-500 to-orange-600',
    emoji: '⭐',
    borderColor: '#fbbf24',
  },
  {
    id: 'avatar-crown-1',
    name: 'المؤسس والشريك',
    roleHint: 'صاحب العمل',
    gradient: 'from-slate-900 via-purple-950 to-amber-900',
    emoji: '👑',
    borderColor: '#d97706',
  },
];

const AVATAR_EVENT = 'bayan_avatar_changed';

function getStorageKey(userId?: number) {
  return `bayan_user_avatar_${userId ?? 'current'}`;
}

const avatarListeners = new Set<() => void>();

function subscribeAvatar(callback: () => void) {
  avatarListeners.add(callback);
  return () => {
    avatarListeners.delete(callback);
  };
}

function notifyAvatarChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AVATAR_EVENT));
    avatarListeners.forEach((fn) => fn());
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(AVATAR_EVENT, () => {
    avatarListeners.forEach((fn) => fn());
  });
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('bayan_user_avatar_')) {
      avatarListeners.forEach((fn) => fn());
    }
  });
}

export function getUserAvatar(userId?: number): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(getStorageKey(userId));
  } catch {
    return null;
  }
}

export function saveUserAvatar(userId: number | undefined, dataUrlOrPresetId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), dataUrlOrPresetId);
    notifyAvatarChange();
  } catch {
    // ignore
  }
}

export function removeUserAvatar(userId?: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getStorageKey(userId));
    notifyAvatarChange();
  } catch {
    // ignore
  }
}

/**
 * Returns consistent pastel background and text styling based on user name string
 */
export function getInitialsStyle(name?: string) {
  const char = (name || 'م').trim().charAt(0);
  const code = char.charCodeAt(0) % 6;
  const palettes = [
    { bg: 'from-blue-600 to-indigo-700', text: 'text-white' },
    { bg: 'from-emerald-600 to-teal-700', text: 'text-white' },
    { bg: 'from-purple-600 to-pink-700', text: 'text-white' },
    { bg: 'from-amber-600 to-orange-700', text: 'text-white' },
    { bg: 'from-rose-600 to-red-700', text: 'text-white' },
    { bg: 'from-cyan-600 to-blue-700', text: 'text-white' },
  ];
  return {
    char,
    gradient: palettes[code].bg,
    text: palettes[code].text,
  };
}

/**
 * Reactive React hook to watch and mutate user avatar
 */
export function useUserAvatar(userId?: number, userName?: string) {
  const getSnapshot = () => getUserAvatar(userId);
  const getServerSnapshot = () => null;

  const currentAvatar = useSyncExternalStore(subscribeAvatar, getSnapshot, getServerSnapshot);

  const setAvatar = useCallback(
    (dataUrlOrPresetId: string) => {
      saveUserAvatar(userId, dataUrlOrPresetId);
    },
    [userId],
  );

  const clearAvatar = useCallback(() => {
    removeUserAvatar(userId);
  }, [userId]);

  const preset = PRESET_AVATARS.find((p) => p.id === currentAvatar);
  const isCustomImage = currentAvatar && currentAvatar.startsWith('data:image/');
  const initials = getInitialsStyle(userName);

  return {
    avatar: currentAvatar,
    preset,
    isCustomImage,
    initials,
    setAvatar,
    clearAvatar,
    presets: PRESET_AVATARS,
  };
}
