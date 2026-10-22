'use client';

import { useId } from 'react';

/**
 * Animated dynamic background for login pages.
 * Features:
 * - Fluid floating luminous gradient orbs with smooth multi-axis CSS keyframes
 * - High-tech geometric ambient grid with glowing junction points
 * - Floating subtle light particles / sparkles drifting upwards
 * - Deep multi-layer perspective with GPU-accelerated transforms
 */
export function AnimatedLoginBackground({
  variant = 'enterprise',
}: {
  variant?: 'enterprise' | 'global-admin';
}) {
  const patternId = useId();

  const isGlobal = variant === 'global-admin';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* Base Deep Cosmic Gradient Canvas */}
      <div
        className={`absolute inset-0 transition-colors duration-700 ${
          isGlobal
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-[#060b18] via-[#09132b] to-[#040814]'
        }`}
      />

      {/* Radial Center Ambient Lighting */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          background: isGlobal
            ? 'radial-gradient(circle 600px at 50% 50%, rgba(99, 102, 241, 0.15), transparent 70%)'
            : 'radial-gradient(circle 700px at 50% 45%, rgba(37, 99, 235, 0.22), rgba(14, 165, 233, 0.1) 40%, transparent 70%)',
        }}
      />

      {/* Floating Animated Fluid Gradient Orbs */}
      {/* Orb 1: Primary Cyan/Blue Orbit */}
      <div
        className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full blur-[110px] opacity-60 mix-blend-screen will-change-transform"
        style={{
          background: isGlobal
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.7) 0%, rgba(139, 92, 246, 0.3) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(37, 99, 235, 0.75) 0%, rgba(6, 182, 212, 0.4) 50%, transparent 70%)',
          animation: 'orbFloatPrimary 22s ease-in-out infinite alternate',
        }}
      />

      {/* Orb 2: Deep Indigo / Violet Orbit (Bottom Right) */}
      <div
        className="absolute -bottom-36 -right-36 h-[560px] w-[560px] rounded-full blur-[120px] opacity-55 mix-blend-screen will-change-transform"
        style={{
          background: isGlobal
            ? 'radial-gradient(circle, rgba(79, 70, 229, 0.7) 0%, rgba(236, 72, 153, 0.35) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.7) 0%, rgba(147, 51, 234, 0.35) 50%, transparent 70%)',
          animation: 'orbFloatSecondary 26s ease-in-out infinite alternate',
        }}
      />

      {/* Orb 3: Radiant Amber / Teal Accent Orbit (Middle) */}
      <div
        className="absolute top-1/3 -right-28 h-[420px] w-[420px] rounded-full blur-[95px] opacity-35 mix-blend-screen will-change-transform"
        style={{
          background: isGlobal
            ? 'radial-gradient(circle, rgba(244, 63, 94, 0.6) 0%, rgba(168, 85, 247, 0.2) 60%, transparent 70%)'
            : 'radial-gradient(circle, rgba(13, 148, 136, 0.65) 0%, rgba(37, 99, 235, 0.25) 60%, transparent 70%)',
          animation: 'orbFloatAccent 20s ease-in-out infinite alternate',
        }}
      />

      {/* Orb 4: Subtle Warm Glow (Bottom Left) */}
      <div
        className="absolute -bottom-24 left-1/4 h-[380px] w-[380px] rounded-full blur-[90px] opacity-25 mix-blend-screen will-change-transform"
        style={{
          background: isGlobal
            ? 'radial-gradient(circle, rgba(234, 88, 12, 0.5) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, rgba(37, 99, 235, 0.2) 60%, transparent 70%)',
          animation: 'orbFloatWarm 28s ease-in-out infinite alternate',
        }}
      />

      {/* High-Tech Isometric Ambient Grid Overlay */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.14] mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={patternId}
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth="0.75"
            />
            <circle cx="0" cy="0" r="1.5" fill="rgba(147, 197, 253, 0.7)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Floating Starlight Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { top: '15%', left: '12%', size: 3, delay: '0s', duration: '6s' },
          { top: '25%', left: '82%', size: 2.5, delay: '1.2s', duration: '7.5s' },
          { top: '70%', left: '18%', size: 3.5, delay: '2.5s', duration: '6.8s' },
          { top: '65%', left: '88%', size: 2, delay: '0.8s', duration: '8.2s' },
          { top: '40%', left: '8%', size: 2, delay: '3.1s', duration: '9s' },
          { top: '80%', left: '72%', size: 3, delay: '1.7s', duration: '7s' },
          { top: '18%', left: '45%', size: 2.5, delay: '4s', duration: '6.4s' },
          { top: '88%', left: '35%', size: 3, delay: '2.2s', duration: '8s' },
        ].map((particle, idx) => (
          <div
            key={idx}
            className="absolute rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)] will-change-transform"
            style={{
              top: particle.top,
              left: particle.left,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `particleTwinkle ${particle.duration} ease-in-out infinite alternate ${particle.delay}`,
            }}
          />
        ))}
      </div>

      {/* Sweeping Soft Glow Beam */}
      <div
        className="absolute -top-1/2 left-1/2 h-[200%] w-[320px] -translate-x-1/2 rotate-25 opacity-[0.07] blur-3xl pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.8), transparent)',
          animation: 'sweepingGlow 16s ease-in-out infinite alternate',
        }}
      />

    </div>
  );
}
