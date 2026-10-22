'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeStyle = 'light' | 'dark' | 'glass' | 'contrast';
export type ColorPreset = 'royal' | 'emerald' | 'indigo' | 'amber' | 'ruby' | 'cyan' | 'slate';
export type RadiusPreset = 'rounded' | 'balanced' | 'compact';

export interface ColorDef {
  id: ColorPreset;
  name: string;
  nameEn: string;
  primary: string;
  hover: string;
  ring: string;
  bgLight: string;
  badgeBg: string;
  badgeText: string;
  gradient: string;
}

export interface StyleDef {
  id: ThemeStyle;
  name: string;
  description: string;
  badge: string;
}

export interface RadiusDef {
  id: RadiusPreset;
  name: string;
  value: string;
}

export const COLOR_PRESETS: Record<ColorPreset, ColorDef> = {
  royal: {
    id: 'royal',
    name: 'أزرق بيان الملكي',
    nameEn: 'Royal Blue',
    primary: '#2563eb',
    hover: '#1d4ed8',
    ring: '#93c5fd',
    bgLight: '#eff6ff',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    gradient: 'from-blue-600 to-indigo-700',
  },
  emerald: {
    id: 'emerald',
    name: 'زمردي نمو الأعمال',
    nameEn: 'Emerald Growth',
    primary: '#059669',
    hover: '#047857',
    ring: '#6ee7b7',
    bgLight: '#ecfdf5',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    gradient: 'from-emerald-600 to-teal-700',
  },
  indigo: {
    id: 'indigo',
    name: 'بنفسجي احترافي',
    nameEn: 'Deep Indigo',
    primary: '#6366f1',
    hover: '#4f46e5',
    ring: '#a5b4fc',
    bgLight: '#eef2ff',
    badgeBg: '#e0e7ff',
    badgeText: '#3730a3',
    gradient: 'from-indigo-600 to-purple-700',
  },
  amber: {
    id: 'amber',
    name: 'عنبر ذهبي ودافئ',
    nameEn: 'Warm Amber',
    primary: '#d97706',
    hover: '#b45309',
    ring: '#fcd34d',
    bgLight: '#fffbeb',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    gradient: 'from-amber-600 to-orange-700',
  },
  ruby: {
    id: 'ruby',
    name: 'ياقوتي فاخر',
    nameEn: 'Ruby Crimson',
    primary: '#e11d48',
    hover: '#be123c',
    ring: '#fda4af',
    bgLight: '#fff1f2',
    badgeBg: '#ffe4e6',
    badgeText: '#9f1239',
    gradient: 'from-rose-600 to-red-700',
  },
  cyan: {
    id: 'cyan',
    name: 'سياني بحري عصري',
    nameEn: 'Ocean Cyan',
    primary: '#0284c7',
    hover: '#0369a1',
    ring: '#7dd3fc',
    bgLight: '#f0f9ff',
    badgeBg: '#e0f2fe',
    badgeText: '#075985',
    gradient: 'from-cyan-600 to-blue-700',
  },
  slate: {
    id: 'slate',
    name: 'فحمي تيتانيوم',
    nameEn: 'Slate Titanium',
    primary: '#334155',
    hover: '#1e293b',
    ring: '#94a3b8',
    bgLight: '#f8fafc',
    badgeBg: '#f1f5f9',
    badgeText: '#1e293b',
    gradient: 'from-slate-700 to-slate-900',
  },
};

export const STYLE_PRESETS: Record<ThemeStyle, StyleDef> = {
  light: {
    id: 'light',
    name: 'فاتح ناصع (Modern Light)',
    description: 'واجهة بيضاء مريحة وواضحة تلائم الاستخدام المكتبي اليومي وبيئة العمل الرسمية.',
    badge: 'الافتراضي',
  },
  dark: {
    id: 'dark',
    name: 'داكن فاخر (Luxe Dark)',
    description: 'خلفيات داكنة عميقة لحماية العين في الإضاءة المنخفضة مع إبراز البيانات بحيوية.',
    badge: 'داكن',
  },
  glass: {
    id: 'glass',
    name: 'زجاجي ناعم (Soft Glassmorphism)',
    description: 'تأثيرات ضبابية شفافة وخلفيات زجاجية عصرية تمنح التطبيق عمقاً بصرياً رائعاً.',
    badge: 'شفاف',
  },
  contrast: {
    id: 'contrast',
    name: 'عالي التباين (High Contrast)',
    description: 'حدود بارزة وتباعد فائق الوضوح مخصص لعمليات الحسابات والفواتير السريعة.',
    badge: 'حسابات',
  },
};

export const RADIUS_PRESETS: Record<RadiusPreset, RadiusDef> = {
  rounded: { id: 'rounded', name: 'منحني عصري (16px)', value: '16px' },
  balanced: { id: 'balanced', name: 'متوازن قياسي (12px)', value: '12px' },
  compact: { id: 'compact', name: 'مدمج حاد (6px)', value: '6px' },
};

interface ThemeState {
  style: ThemeStyle;
  color: ColorPreset;
  radius: RadiusPreset;
}

interface ThemeContextValue {
  style: ThemeStyle;
  color: ColorPreset;
  radius: RadiusPreset;
  colorDef: ColorDef;
  styleDef: StyleDef;
  radiusDef: RadiusDef;
  setStyle: (style: ThemeStyle) => void;
  setColor: (color: ColorPreset) => void;
  setRadius: (radius: RadiusPreset) => void;
  resetTheme: () => void;
  isCustomizerOpen: boolean;
  openCustomizer: () => void;
  closeCustomizer: () => void;
}

const STORAGE_KEY = 'bayan_theme_settings_v1';

const DEFAULT_THEME: ThemeState = {
  style: 'light',
  color: 'royal',
  radius: 'rounded',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeToDocument(state: ThemeState) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const colorDef = COLOR_PRESETS[state.color] || COLOR_PRESETS.royal;
  const radiusDef = RADIUS_PRESETS[state.radius] || RADIUS_PRESETS.rounded;

  // Set CSS Custom Properties on :root
  root.style.setProperty('--primary', colorDef.primary);
  root.style.setProperty('--primary-hover', colorDef.hover);
  root.style.setProperty('--primary-ring', colorDef.ring);
  root.style.setProperty('--primary-light', colorDef.bgLight);
  root.style.setProperty('--primary-badge-bg', colorDef.badgeBg);
  root.style.setProperty('--primary-badge-text', colorDef.badgeText);
  root.style.setProperty('--card-radius', radiusDef.value);

  // Set HTML attributes for styling hooks
  root.setAttribute('data-theme-style', state.style);
  root.setAttribute('data-theme-color', state.color);
  root.setAttribute('data-theme-radius', state.radius);

  // Dark class toggle
  if (state.style === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Glass class toggle
  if (state.style === 'glass') {
    root.classList.add('theme-glass');
  } else {
    root.classList.remove('theme-glass');
  }

  // Contrast class toggle
  if (state.style === 'contrast') {
    root.classList.add('theme-contrast');
  } else {
    root.classList.remove('theme-contrast');
  }
}

function getSavedTheme(): ThemeState {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ThemeState>;
      const validStyle = parsed.style && STYLE_PRESETS[parsed.style] ? parsed.style : DEFAULT_THEME.style;
      const validColor = parsed.color && COLOR_PRESETS[parsed.color] ? parsed.color : DEFAULT_THEME.color;
      const validRadius = parsed.radius && RADIUS_PRESETS[parsed.radius] ? parsed.radius : DEFAULT_THEME.radius;
      return { style: validStyle, color: validColor, radius: validRadius };
    }
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeState>(getSavedTheme);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Apply theme to DOM on mount and when theme changes
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setStyle = useCallback((style: ThemeStyle) => {
    setThemeState((prev) => {
      const next = { ...prev, style };
      applyThemeToDocument(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const setColor = useCallback((color: ColorPreset) => {
    setThemeState((prev) => {
      const next = { ...prev, color };
      applyThemeToDocument(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const setRadius = useCallback((radius: RadiusPreset) => {
    setThemeState((prev) => {
      const next = { ...prev, radius };
      applyThemeToDocument(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    setThemeState(DEFAULT_THEME);
    applyThemeToDocument(DEFAULT_THEME);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_THEME));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({
      style: theme.style,
      color: theme.color,
      radius: theme.radius,
      colorDef: COLOR_PRESETS[theme.color] || COLOR_PRESETS.royal,
      styleDef: STYLE_PRESETS[theme.style] || STYLE_PRESETS.light,
      radiusDef: RADIUS_PRESETS[theme.radius] || RADIUS_PRESETS.rounded,
      setStyle,
      setColor,
      setRadius,
      resetTheme,
      isCustomizerOpen,
      openCustomizer: () => setIsCustomizerOpen(true),
      closeCustomizer: () => setIsCustomizerOpen(false),
    }),
    [theme, setStyle, setColor, setRadius, resetTheme, isCustomizerOpen],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
