/**
 * Decorative café/restaurant scene for auth screens, replacing a flat gradient with
 * something evocative — a large coffee cup with drifting steam, scattered beans, a pastry,
 * and soft ambient "pendant light" bokeh — all tinted from the tenant's own accent color
 * (or Yummverse's indigo on the platform login) so it stays on-brand per café rather than
 * being a fixed photo. Swap this out for a real photograph (an `<img>` layered the same
 * way) whenever the café has licensed imagery of their own space to use instead.
 */
export function CafeBackdrop({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Ambient bokeh — like soft, out-of-focus pendant lighting over a café counter */}
      <div className="absolute -left-16 top-[6%] h-56 w-56 rounded-full bg-white opacity-40 blur-3xl" />
      <div className="absolute -right-14 top-[34%] h-80 w-80 rounded-full bg-white opacity-[0.22] blur-3xl" />
      <div className="absolute -bottom-24 left-[14%] h-72 w-72 rounded-full bg-white opacity-[0.18] blur-3xl" />
      <div className="absolute -bottom-10 right-[6%] h-40 w-40 rounded-full bg-white opacity-[0.16] blur-2xl" />

      {/* Large cup, anchored bottom-right */}
      <svg
        className="absolute bottom-[-4%] right-[-10%] h-[70%] w-auto opacity-[0.22]"
        viewBox="0 0 240 240"
        fill="none"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g style={{ animation: "steamDrift 3.2s ease-in-out infinite" }}>
          <path d="M90 40 C80 30, 100 20, 90 8" />
        </g>
        <g style={{ animation: "steamDrift 3.2s ease-in-out infinite 0.6s" }}>
          <path d="M115 40 C105 30, 125 20, 115 8" />
        </g>
        <g style={{ animation: "steamDrift 3.2s ease-in-out infinite 1.2s" }}>
          <path d="M140 40 C130 30, 150 20, 140 8" />
        </g>
        <path d="M55 70 H165 L155 165 C153 178, 142 188, 128 188 H92 C78 188, 67 178, 65 165 L55 70 Z" />
        <path d="M165 82 H188 C200 82, 208 92, 208 104 C208 116, 200 126, 188 126 H160" />
        <ellipse cx="112" cy="205" rx="78" ry="12" />
      </svg>

      {/* Small cup, top-left, for balance */}
      <svg
        className="absolute -left-6 -top-6 h-28 w-auto rotate-[-12deg] opacity-[0.16]"
        viewBox="0 0 240 240"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M90 40 C80 30, 100 20, 90 8" />
        <path d="M140 40 C130 30, 150 20, 140 8" />
        <path d="M55 70 H165 L155 165 C153 178, 142 188, 128 188 H92 C78 188, 67 178, 65 165 L55 70 Z" />
        <ellipse cx="112" cy="205" rx="78" ry="12" />
      </svg>

      {/* Coffee beans, scattered */}
      {[
        { top: "12%", left: "72%", size: 46, rotate: 20, opacity: 0.18 },
        { top: "20%", left: "8%", size: 30, rotate: -15, opacity: 0.16 },
        { top: "58%", left: "88%", size: 26, rotate: 40, opacity: 0.14 },
        { top: "72%", left: "4%", size: 34, rotate: 8, opacity: 0.15 },
      ].map((bean, i) => (
        <svg
          key={i}
          className="absolute fill-white"
          style={{ top: bean.top, left: bean.left, width: bean.size, height: bean.size, transform: `rotate(${bean.rotate}deg)`, opacity: bean.opacity }}
          viewBox="0 0 40 40"
        >
          <path d="M20 4c-9 0-16 7-16 16s7 16 16 16 16-7 16-16S29 4 20 4zm0 4c1.5 3 1.5 21 0 24-6-1.5-10-6.5-10-12s4-10.5 10-12z" />
        </svg>
      ))}

      {/* Croissant, upper area for variety */}
      <svg
        className="absolute right-[10%] top-[16%] h-10 w-10 opacity-[0.16]"
        viewBox="0 0 48 48"
        fill="white"
      >
        <path d="M6 30c2-10 10-18 20-18 3 0 5 3 4 6-1 2-3 2-5 3 4 0 8 2 8 6 0 3-2 4-4 4 3 1 5 3 4 6-1 3-4 4-7 3-6-2-9-6-11-10-3 3-6 6-9 5-2-1-2-3-1-5-1 1-3 1-4-1-1-1 0-3 1-4z" />
      </svg>

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 30% 0%, ${accent} 0%, transparent 55%)`,
          mixBlendMode: "overlay",
          opacity: 0.5,
        }}
      />
    </div>
  );
}
