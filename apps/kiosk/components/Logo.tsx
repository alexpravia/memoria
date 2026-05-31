"use client";
/**
 * Memoria flower logo — web version.
 * Identical geometry to the mobile Logo.tsx but using plain HTML <svg>.
 * Gradient IDs are namespaced with useId() so multiple Logos on one page
 * don't collide.
 */

import React, { useId } from "react";

const PETAL =
  "M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z";

export function Logo({ size = 48 }: { size?: number }) {
  const uid = useId();
  const petalId = `${uid}-petal`;
  const eyeId = `${uid}-eye`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <radialGradient id={petalId} cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ddc8ff" />
          <stop offset="0.48" stopColor="#9c6bff" />
          <stop offset="1" stopColor="#7340d8" />
        </radialGradient>
        <radialGradient id={eyeId} cx="50%" cy="42%" r="60%">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.6" stopColor="#f6c64f" />
          <stop offset="1" stopColor="#e7a92f" />
        </radialGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={PETAL}
          transform={`rotate(${i * 72} 24 24)`}
          fill={`url(#${petalId})`}
          stroke="#ffffff"
          strokeOpacity={0.12}
          strokeWidth={0.5}
        />
      ))}
      <circle cx={24} cy={24} r={4.5} fill="#fdfdff" />
      <circle cx={24} cy={24} r={2.8} fill={`url(#${eyeId})`} />
      <circle cx={24} cy={24} r={0.95} fill="#d89a2c" />
    </svg>
  );
}
