'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { UserAvatar } from './user-avatar';
import { ProfileModal, type ProfileTab } from './profile-modal';
import {
  IconCamera,
  IconChevronDown,
  IconLock,
  IconLogOut,
  IconPalette,
  IconUser,
} from './icons';

export function UserProfileMenu({
  className = '',
}: {
  className?: string;
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colorDef, openCustomizer } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ProfileTab>('info');

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openProfileWithTab = (tab: ProfileTab) => {
    setModalTab(tab);
    setMenuOpen(false);
    setProfileModalOpen(true);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.replace('/login');
  };

  return (
    <>
      {/* Profile & Password Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialTab={modalTab}
      />

      {/* Trigger Button with Dropdown Container */}
      <div ref={menuRef} className={`relative select-none ${className}`}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className={`flex items-center gap-2 rounded-2xl border p-1 sm:px-2.5 sm:py-1.5 transition-all cursor-pointer ${
            menuOpen
              ? 'border-blue-500 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
              : 'border-slate-200/90 bg-white/90 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
          }`}
          title="الملف الشخصي والحساب"
          aria-expanded={menuOpen}
        >
          {/* Avatar with Online Pulse */}
          <UserAvatar userId={user?.id} name={user?.name} size={30} showStatus={true} />

          {/* User Name & Role (Tablet & Desktop) */}
          <div className="hidden sm:flex flex-col text-start min-w-0">
            <span className="text-xs font-black text-slate-800 truncate max-w-[110px] leading-tight">
              {user?.name || 'مستخدم'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 truncate max-w-[110px]">
              {user?.roleCode || 'عضو'}
            </span>
          </div>

          <IconChevronDown
            size={14}
            className={`hidden sm:block text-slate-400 transition-transform duration-200 ${
              menuOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {menuOpen ? (
          <div
            className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200/90 bg-white shadow-xl p-1.5 z-50 animate-entrance"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header User Summary */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 via-white to-blue-50/40 border border-slate-100 mb-1.5">
              <UserAvatar userId={user?.id} name={user?.name} size={42} showStatus={true} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 truncate">{user?.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded">
                    {user?.roleCode || 'مستخدم'}
                  </span>
                  {user?.repCode ? (
                    <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded">
                      {user.repCode}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-0.5">
              {/* Edit Profile */}
              <button
                type="button"
                onClick={() => openProfileWithTab('info')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-start cursor-pointer"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <IconUser size={15} />
                </span>
                <span>تعديل الملف الشخصي</span>
              </button>

              {/* Change Picture */}
              <button
                type="button"
                onClick={() => openProfileWithTab('picture')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-start cursor-pointer"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <IconCamera size={15} />
                </span>
                <span>تغيير الصورة الشخصية</span>
              </button>

              {/* Edit Password */}
              <button
                type="button"
                onClick={() => openProfileWithTab('password')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-start cursor-pointer"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <IconLock size={15} />
                </span>
                <span>تعديل كلمة المرور</span>
              </button>

              {/* Preset Styles and Colors */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openCustomizer();
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-start cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <IconPalette size={15} />
                  </span>
                  <span>المظهر والألوان</span>
                </div>
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-2xs"
                  style={{ backgroundColor: colorDef.primary }}
                  title={colorDef.name}
                />
              </button>

              {/* Go to Dedicated Profile Page */}
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-start"
              >
                <span className="text-[11px] text-blue-600 font-semibold mr-1">
                  عرض صفحة الحساب الكاملة ←
                </span>
              </Link>
            </div>

            {/* Logout Action */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-start cursor-pointer"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <IconLogOut size={15} />
                </span>
                <span>تسجيل الخروج من النظام</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
