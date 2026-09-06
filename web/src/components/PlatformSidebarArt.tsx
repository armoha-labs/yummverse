/** A whisper of café/restaurant texture behind the Platform Admin sidebar's dark panel —
 * scattered cup and bean outlines plus soft glow, kept very low-opacity so it never
 * competes with the nav labels sitting on top of it. Platform Admin oversees many cafés
 * at once, so this stays neutral (indigo, the platform's own color) rather than any one
 * tenant's brand. */
export function PlatformSidebarArt() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-10 top-[-8%] h-52 w-52 rounded-full bg-accent opacity-30 blur-3xl" />
      <div className="absolute -right-16 top-[55%] h-64 w-64 rounded-full bg-accent opacity-20 blur-3xl" />
      <div className="absolute -bottom-16 left-[-10%] h-56 w-56 rounded-full bg-white opacity-[0.06] blur-3xl" />

      <svg
        className="absolute -right-8 top-6 h-32 w-auto rotate-[8deg] opacity-[0.09]"
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

      <svg
        className="absolute -left-10 bottom-24 h-36 w-auto rotate-[-10deg] opacity-[0.08]"
        viewBox="0 0 240 240"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M90 40 C80 30, 100 20, 90 8" />
        <path d="M115 40 C105 30, 125 20, 115 8" />
        <path d="M140 40 C130 30, 150 20, 140 8" />
        <path d="M55 70 H165 L155 165 C153 178, 142 188, 128 188 H92 C78 188, 67 178, 65 165 L55 70 Z" />
        <path d="M165 82 H188 C200 82, 208 92, 208 104 C208 116, 200 126, 188 126 H160" />
        <ellipse cx="112" cy="205" rx="78" ry="12" />
      </svg>

      {[
        { top: "38%", left: "62%", size: 34, rotate: 15 },
        { top: "72%", left: "70%", size: 24, rotate: -20 },
        { top: "16%", left: "18%", size: 22, rotate: 30 },
      ].map((bean, i) => (
        <svg
          key={i}
          className="absolute fill-white opacity-[0.08]"
          style={{ top: bean.top, left: bean.left, width: bean.size, height: bean.size, transform: `rotate(${bean.rotate}deg)` }}
          viewBox="0 0 40 40"
        >
          <path d="M20 4c-9 0-16 7-16 16s7 16 16 16 16-7 16-16S29 4 20 4zm0 4c1.5 3 1.5 21 0 24-6-1.5-10-6.5-10-12s4-10.5 10-12z" />
        </svg>
      ))}
    </div>
  );
}
