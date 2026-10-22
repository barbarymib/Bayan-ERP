'use client';

import {
  COLOR_PRESETS,
  RADIUS_PRESETS,
  STYLE_PRESETS,
  useTheme,
  type ColorPreset,
  type RadiusPreset,
  type ThemeStyle,
} from '@/lib/theme';
import { Button, Modal } from './ui';
import { IconCheck, IconPalette, IconRefresh, IconSparkles } from './icons';

export function ThemeCustomizerModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    style,
    color,
    radius,
    colorDef,
    styleDef,
    setStyle,
    setColor,
    setRadius,
    resetTheme,
  } = useTheme();

  if (!isOpen) return null;

  return (
    <Modal
      title="تخصيص المظهر والألوان"
      description="اختر أسلوب الواجهة ونظام الألوان المفضل لديك لتحصل على تجربة مخصصة تماماً"
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetTheme}
            icon={<IconRefresh size={14} />}
            className="text-slate-500 hover:text-slate-800"
          >
            استعادة الافتراضي
          </Button>
          <Button variant="primary" size="md" onClick={onClose} icon={<IconCheck size={16} />}>
            تم واعتماد التخصيص
          </Button>
        </div>
      }
    >
      <div className="space-y-6 py-1 select-none">
        {/* Section 1: Preset Styles (Visual Mode) */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">
              1. أنماط الواجهة الجاهزة (Preset Styles)
            </label>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              النمط النشط: {styleDef.name.split('(')[0].trim()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(STYLE_PRESETS) as ThemeStyle[]).map((key) => {
              const item = STYLE_PRESETS[key];
              const isActive = style === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStyle(key)}
                  className={`group relative flex flex-col items-start rounded-2xl p-4 text-start transition-all cursor-pointer border-2 ${
                    isActive
                      ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-3 ring-blue-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                  }`}
                >
                  <div className="flex w-full items-center justify-between mb-2">
                    <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                      {item.name}
                    </span>
                    {isActive ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                        <IconCheck size={12} />
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-normal leading-relaxed">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Preset Color Palettes */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">
              2. باليتات الألوان والسمات (Preset Colors)
            </label>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
              style={{
                backgroundColor: colorDef.bgLight,
                color: colorDef.badgeText,
                borderColor: colorDef.ring,
              }}
            >
              اللون: {colorDef.name}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((key) => {
              const item = COLOR_PRESETS[key];
              const isActive = color === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  className={`flex items-center gap-2.5 rounded-xl p-2.5 transition-all text-start cursor-pointer border ${
                    isActive
                      ? 'border-slate-900 bg-slate-50 shadow-xs ring-2 ring-slate-900/15'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-inner ring-2 ring-white"
                    style={{ backgroundColor: item.primary }}
                  >
                    {isActive ? <IconCheck size={14} className="text-white drop-shadow-xs" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{item.nameEn}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Corner Radius Styles */}
        <div>
          <label className="block mb-2 text-xs font-black uppercase tracking-wider text-slate-700">
            3. انحناء الحواف والإطارات (Corner Radius)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(RADIUS_PRESETS) as RadiusPreset[]).map((key) => {
              const item = RADIUS_PRESETS[key];
              const isActive = radius === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRadius(key)}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 border text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{item.name}</span>
                  {isActive ? <IconCheck size={14} className="text-blue-600" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-xs font-black text-slate-700">
              <IconSparkles size={14} className="text-blue-600" />
              <span>معاينة حية فورية للنمط المحدد (Live Preview)</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400">تحديث فوري تلقائي</span>
          </div>

          <div
            className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-slate-200"
            style={{ borderRadius: RADIUS_PRESETS[radius].value }}
          >
            {/* Sample Button */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white shadow-xs transition-all active:scale-95"
              style={{
                backgroundColor: colorDef.primary,
                borderRadius: RADIUS_PRESETS[radius].value,
              }}
            >
              <IconPalette size={14} />
              <span>زر أساسي بالنظام</span>
            </button>

            {/* Sample Badge */}
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold border"
              style={{
                backgroundColor: colorDef.bgLight,
                color: colorDef.badgeText,
                borderColor: colorDef.ring,
                borderRadius: RADIUS_PRESETS[radius].value,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorDef.primary }} />
              <span>شارة حالة معتمدة</span>
            </span>

            {/* Sample Indicator */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full shadow-xs animate-pulse"
                style={{ backgroundColor: colorDef.primary }}
              />
              <span>إشعار نشط</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
