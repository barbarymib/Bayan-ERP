'use client';

import { useUserAvatar } from '@/lib/avatar';

export function UserAvatar({
  userId,
  name,
  size = 36,
  showStatus = false,
  className = '',
}: {
  userId?: number;
  name?: string;
  size?: number;
  showStatus?: boolean;
  className?: string;
}) {
  const { avatar, preset, isCustomImage, initials } = useUserAvatar(userId, name);

  const sizeCls =
    size >= 56
      ? 'text-xl'
      : size >= 40
      ? 'text-sm'
      : size >= 32
      ? 'text-xs'
      : 'text-[10px]';

  return (
    <div
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-2xl shadow-2xs font-black overflow-hidden ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {isCustomImage && avatar ? (
        // User uploaded custom image
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatar}
          alt={name || 'صورة المستخدم'}
          className="h-full w-full object-cover"
        />
      ) : preset ? (
        // User chosen preset character
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${preset.gradient} text-white shadow-inner`}
        >
          <span className="drop-shadow-xs" style={{ fontSize: `${Math.round(size * 0.52)}px` }}>
            {preset.emoji}
          </span>
        </div>
      ) : (
        // Default dynamic gradient with user initial
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${initials.gradient} ${initials.text} ${sizeCls} shadow-inner`}
        >
          <span>{initials.char}</span>
        </div>
      )}

      {showStatus ? (
        <span
          className="absolute -bottom-0.5 -left-0.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs"
          style={{
            width: `${Math.max(6, Math.round(size * 0.24))}px`,
            height: `${Math.max(6, Math.round(size * 0.24))}px`,
          }}
        />
      ) : null}
    </div>
  );
}
