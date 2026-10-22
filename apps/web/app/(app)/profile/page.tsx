'use client';

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { get, patch, post } from '@/lib/api';
import { useUserAvatar } from '@/lib/avatar';
import { COLOR_PRESETS, RADIUS_PRESETS, STYLE_PRESETS, useTheme, type ColorPreset, type RadiusPreset, type ThemeStyle } from '@/lib/theme';
import { Button, Field, Notice, PageHeader, TextInput } from '@/components/ui';
import { UserAvatar } from '@/components/user-avatar';
import {
  IconCamera,
  IconCheck,
  IconKey,
  IconLock,
  IconLogOut,
  IconPalette,
  IconRefresh,
  IconSparkles,
  IconUpload,
  IconUser,
} from '@/components/icons';

interface UserProfileData {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  repCode: string | null;
  roleId: number;
  branchId: number | null;
  maxItemDiscountPct: string | number;
  maxInvoiceDiscountPct: string | number;
  role?: { code: string; nameAr: string };
  branch?: { id: number; nameAr: string; code: string } | null;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'picture' | 'password' | 'theme'>('info');

  // Personal Info Form State
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [infoBusy, setInfoBusy] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Avatar Hook
  const { avatar, setAvatar, clearAvatar, presets } = useUserAvatar(user?.id, user?.name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Theme Hook
  const { style, color, radius, setStyle, setColor, setRadius, resetTheme, colorDef, styleDef } = useTheme();

  // Load latest profile details
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    get<UserProfileData>('/users/me/profile')
      .then((data) => {
        if (!cancelled && data) {
          setProfile(data);
          setName(data.name || user.name || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
        }
      })
      .catch(() => {
        // Fallback gracefully
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Submit Personal Info
  async function onSaveInfo(e: FormEvent) {
    e.preventDefault();
    setInfoBusy(true);
    setInfoNotice(null);
    setInfoError(null);

    try {
      const res = await patch<UserProfileData>('/users/me/profile', {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setProfile((prev) => (prev ? { ...prev, ...res } : res));
      setInfoNotice('تم تحديث البيانات الشخصية بنجاح');
      setTimeout(() => setInfoNotice(null), 4000);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'فشل تحديث البيانات الشخصية');
    } finally {
      setInfoBusy(false);
    }
  }

  // Handle Photo File Upload
  function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 3 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
        setAvatarNotice('تم تعيين الصورة الشخصية بنجاح');
        setTimeout(() => setAvatarNotice(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  }

  // Submit Password Change
  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwdBusy(true);
    setPwdNotice(null);
    setPwdError(null);

    if (newPassword.length < 6) {
      setPwdError('يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل');
      setPwdBusy(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      setPwdBusy(false);
      return;
    }

    try {
      await post('/users/me/change-password', {
        currentPassword,
        newPassword,
      });
      setPwdNotice('تم تغيير كلمة المرور بنجاح. يرجى تذكرها لعمليات الدخول القادمة.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdNotice(null), 5000);
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'فشل تغيير كلمة المرور. تأكد من كلمة المرور الحالية.');
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="الملف الشخصي وإعدادات الحساب"
        description="إدارة بياناتك الشخصية، صورتك، كلمة المرور، وتخصيص أنظمة الألوان ومظهر التطبيق"
        action={
          <Button
            variant="danger"
            size="sm"
            onClick={logout}
            icon={<IconLogOut size={16} />}
          >
            تسجيل الخروج
          </Button>
        }
      />

      {/* Hero User Profile Header Card */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl overflow-hidden border border-slate-700/60">
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group">
            <UserAvatar userId={user?.id} name={user?.name} size={84} showStatus={true} />
            <button
              type="button"
              onClick={() => setActiveTab('picture')}
              className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs cursor-pointer"
              title="تغيير الصورة"
            >
              <IconCamera size={26} />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-start min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-xl font-black">{name || user?.name}</h2>
              <span className="rounded-lg bg-blue-500/25 px-2.5 py-1 text-xs font-bold text-blue-300 border border-blue-400/30">
                {profile?.role?.nameAr || user?.roleCode || 'مستخدم'}
              </span>
              {user?.repCode ? (
                <span className="rounded-lg bg-purple-500/25 px-2.5 py-1 text-xs font-mono font-bold text-purple-300 border border-purple-400/30">
                  كود المندوب: {user.repCode}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-slate-300" dir="ltr">
              {email || phone || 'مستخدم نظام بيان ERP لإدارة الحدايد والبويات'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('picture')}
              icon={<IconCamera size={14} />}
              className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20"
            >
              تغيير الصورة
            </Button>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-blue-600/30 blur-3xl" />
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 select-none overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'info'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <IconUser size={16} />
          <span>البيانات الشخصية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('picture')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'picture'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <IconCamera size={16} />
          <span>الصورة الشخصية</span>
          {avatar ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'password'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <IconLock size={16} />
          <span>كلمة المرور والأمان</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'theme'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <IconPalette size={16} />
          <span>المظهر والألوان</span>
        </button>
      </div>

      {/* Content Container */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Tab 1: Info */}
        {activeTab === 'info' ? (
          <form onSubmit={onSaveInfo} className="space-y-5">
            {infoNotice ? <Notice type="success">{infoNotice}</Notice> : null}
            {infoError ? <Notice type="error">{infoError}</Notice> : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="الاسم الكامل" required>
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أحمد علي…"
                  required
                />
              </Field>

              <Field label="البريد الإلكتروني">
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@bayan.local"
                  dir="ltr"
                />
              </Field>

              <Field label="رقم الهاتف">
                <TextInput
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  dir="ltr"
                />
              </Field>

              <Field label="الدور الوظيفي الحالي">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>{profile?.role?.nameAr || user?.roleCode || 'مستخدم'}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{user?.roleCode}</span>
                </div>
              </Field>
            </div>

            {/* Discount Limits Summary */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900">
              <div className="font-bold mb-2 flex items-center gap-1.5">
                <IconSparkles size={16} className="text-blue-600" />
                <span>حدود الخصومات المصرح بها لحسابك (§4.2):</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div className="rounded-xl bg-white p-3 border border-blue-200/60 shadow-2xs">
                  <span className="text-slate-500 block text-[11px] mb-0.5">أقصى خصم على مستوى الصنف:</span>
                  <span className="font-black text-base text-blue-700">
                    {Number(profile?.maxItemDiscountPct ?? (user?.roleCode === 'ADMIN' ? 100 : 0))}%
                  </span>
                </div>
                <div className="rounded-xl bg-white p-3 border border-blue-200/60 shadow-2xs">
                  <span className="text-slate-500 block text-[11px] mb-0.5">أقصى خصم على مستوى الفاتورة:</span>
                  <span className="font-black text-base text-blue-700">
                    {Number(profile?.maxInvoiceDiscountPct ?? (user?.roleCode === 'ADMIN' ? 100 : 0))}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button type="submit" loading={infoBusy} icon={<IconCheck size={16} />}>
                حفظ التعديلات
              </Button>
            </div>
          </form>
        ) : null}

        {/* Tab 2: Picture */}
        {activeTab === 'picture' ? (
          <div className="space-y-6">
            {avatarNotice ? <Notice type="success">{avatarNotice}</Notice> : null}

            {/* Current Avatar Station */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex items-center gap-4">
                <UserAvatar userId={user?.id} name={user?.name} size={76} showStatus={true} />
                <div>
                  <h4 className="text-sm font-black text-slate-900">صورتك الرمزية الحالية</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اختر صورة تعبر عنك أو ارفع صورة حقيقية من هاتفك أو جهاز الكمبيوتر.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<IconUpload size={16} />}
                >
                  رفع صورة من الجهاز
                </Button>
                {avatar ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      clearAvatar();
                      setAvatarNotice('تمت إزالة الصورة والرجوع للحرف الافتراضي');
                      setTimeout(() => setAvatarNotice(null), 3000);
                    }}
                    className="text-red-600 hover:bg-red-50 hover:border-red-200"
                  >
                    إزالة الصورة
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Presets Grid */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  شخصيات رمزية جاهزة (Preset Avatars)
                </label>
                <span className="text-xs font-bold text-slate-400">12 شخصية ملونة ومصنفة</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {presets.map((p) => {
                  const isSelected = avatar === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAvatar(p.id);
                        setAvatarNotice(`تم اختيار الشخصية: ${p.name}`);
                        setTimeout(() => setAvatarNotice(null), 3000);
                      }}
                      className={`group relative flex items-center gap-3 rounded-2xl p-3 transition-all text-start cursor-pointer border ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.gradient} text-2xl shadow-xs text-white`}
                      >
                        <span>{p.emoji}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{p.roleHint}</div>
                      </div>
                      {isSelected ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs">
                          <IconCheck size={12} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Tab 3: Password */}
        {activeTab === 'password' ? (
          <form onSubmit={onChangePassword} className="space-y-5">
            {pwdNotice ? <Notice type="success">{pwdNotice}</Notice> : null}
            {pwdError ? <Notice type="error">{pwdError}</Notice> : null}

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 leading-relaxed">
              <span className="font-bold block mb-1">تعليمات أمان كلمة المرور:</span>
              يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام، وتجنب استخدام كلمات شائعة أو بسيطة لضمان سلامة بيانات الحساب.
            </div>

            <Field label="كلمة المرور الحالية" required>
              <TextInput
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
              />
            </Field>

            <Field label="كلمة المرور الجديدة" hint="6 أحرف أو أرقام على الأقل" required>
              <TextInput
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
              />
            </Field>

            <Field label="تأكيد كلمة المرور الجديدة" required>
              <TextInput
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
              />
            </Field>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>إظهار كلمات المرور أثناء الكتابة</span>
              </label>

              {newPassword && confirmPassword ? (
                <span
                  className={`text-xs font-bold ${
                    newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {newPassword === confirmPassword ? '✓ الكلمات متطابقة' : '✗ غير متطابقة'}
                </span>
              ) : null}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                type="submit"
                loading={pwdBusy}
                disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                icon={<IconKey size={16} />}
              >
                تحديث كلمة المرور
              </Button>
            </div>
          </form>
        ) : null}

        {/* Tab 4: Theme */}
        {activeTab === 'theme' ? (
          <div className="space-y-6">
            {/* Styles */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  1. أنماط الواجهة (Theme Styles)
                </label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  النمط المختار: {styleDef.name.split('(')[0].trim()}
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
                      className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer ${
                        isActive
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/15 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        {isActive ? <IconCheck size={16} className="text-blue-600" /> : null}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colors */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  2. ألوان السمة والتمييز (Preset Colors)
                </label>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colorDef.bgLight, color: colorDef.hover }}
                >
                  اللون: {colorDef.name}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((key) => {
                  const item = COLOR_PRESETS[key];
                  const isActive = color === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setColor(key)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-start cursor-pointer transition-all ${
                        isActive
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/15 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center shadow-inner"
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

            {/* Radius */}
            <div>
              <label className="block mb-3 text-xs font-black uppercase tracking-wider text-slate-700">
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
                      className={`flex items-center justify-between rounded-xl px-4 py-2.5 border text-xs font-bold transition-all cursor-pointer ${
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

            <div className="flex justify-start pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetTheme}
                icon={<IconRefresh size={14} />}
                className="text-slate-500"
              >
                استعادة الإعدادات الافتراضية للواجهة
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
