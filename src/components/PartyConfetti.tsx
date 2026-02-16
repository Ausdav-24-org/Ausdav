import React, { useEffect, useState } from 'react';

const COLORS = ['#06b6d4', '#7c3aed', '#f97316', '#10b981', '#ef4444', '#facc15'];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

const ConfettiPiece: React.FC<{ style: React.CSSProperties; color: string }> = ({ style, color }) => (
  <div
    className="confetti-piece"
    style={{
      background: color,
      ...style,
    }}
  />
);

const PartyConfetti: React.FC<{ count?: number; active?: boolean }> = ({ count = 20, active = true }) => {
  const [pieces] = useState(() =>
    Array.from({ length: count }).map(() => ({
      left: `${Math.floor(rand(5, 95))}%`,
      delay: `${rand(0, 0.6)}s`,
      duration: `${rand(2, 4.2)}s`,
      rotate: `${Math.floor(rand(0, 360))}deg`,
      w: Math.floor(rand(6, 12)),
      h: Math.floor(rand(10, 18)),
      color: COLORS[Math.floor(rand(0, COLORS.length))],
    })),
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <ConfettiPiece
          key={i}
          color={p.color}
          style={{
            left: p.left,
            width: p.w,
            height: p.h,
            top: '-8%',
            transform: `rotate(${p.rotate})`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
};

export default PartyConfetti;
