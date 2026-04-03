import React from 'react';

// Elegant open-petal flower — stroke-outlined petals, thin stem, leaf, falling petal.
// Petals don't close at the base so the centre stays open and clean.
export default function NeedleLogo({ size = 36, color = '#2c2c2c' }) {
  // Open-base petal: tip at top, sides curve out then back, base is open (no Z)
  // The petal points up from (50, 30), tip at (50, 4)
  const petal = "M 50,30 C 44,28 39,20 39,13 C 39,7 44,4 50,4 C 56,4 61,7 61,13 C 61,20 56,28 50,30";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* ── 5 open-base petals rotated around (50, 30) ── */}
      {[0, 72, 144, 216, 288].map(a => (
        <path
          key={a}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d={petal}
          transform={`rotate(${a}, 50, 30)`}
        />
      ))}

      {/* ── Stem — gently curved ── */}
      <path
        stroke={color}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        d="M 50,56 C 49,66 48,75 47,88"
      />

      {/* ── Leaf — stroke outline with light fill ── */}
      <path
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M 48,74 C 41,65 28,67 30,76 C 35,83 48,78 48,74 Z"
      />

      {/* ── Falling petal — drifting right ── */}
      <path
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M 0,0 C -5,-2.5 -5,-11 0,-13 C 5,-11 5,-2.5 0,0 Z"
        transform="translate(78,50) rotate(40)"
      />
    </svg>
  );
}
