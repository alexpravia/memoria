/* memoria-icons.jsx — Memoria custom icon set, ported to web SVG.
   Rounded-stroke, 24px grid, 2px weight. Matches the brand chevron. */

const ICON_PATHS = {
  mark: (s, a) => <path {...s} strokeWidth={2.6} d="M5 15 12 8l7 7" />,
  memo: (s, a, c) => <>
    <path {...s} d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4z" />
    <circle cx={9} cy={10} r={0.9} fill={c} stroke="none" />
    <circle cx={12} cy={10} r={0.9} fill={c} stroke="none" />
    <circle cx={15} cy={10} r={0.9} fill={c} stroke="none" />
  </>,
  startDay: (s) => <>
    <path {...s} d="M7.5 17a4.5 4.5 0 0 1 9 0" />
    <path {...s} d="M3 20h18M12 4v2.4M5.6 8.1l1.5 1.5M18.4 8.1l-1.5 1.5" />
  </>,
  whoAmI: (s) => <>
    <rect {...s} x={3.5} y={5} width={17} height={14} rx={2.5} />
    <circle {...s} cx={9} cy={11} r={2} />
    <path {...s} d="M6 16.3a3 3 0 0 1 6 0M14.5 10h3M14.5 13.5h3" />
  </>,
  listen: (s) => <>
    <path {...s} d="M4 9.5h3.5L12 6v12L7.5 14.5H4z" />
    <path {...s} d="M15.4 9.2a4 4 0 0 1 0 5.6M18 7a7.5 7.5 0 0 1 0 10" />
  </>,
  contacts: (s) => <>
    <rect {...s} x={5.5} y={3.5} width={13.5} height={17} rx={2} />
    <path {...s} d="M3 8h2.7M3 12h2.7M3 16h2.7" />
    <circle {...s} cx={12.5} cy={10} r={2} />
    <path {...s} d="M9 16.3a3.5 3.5 0 0 1 7 0" />
  </>,
  calendar: (s, a) => <>
    <rect {...s} x={4} y={5} width={16} height={15} rx={2} />
    <path {...s} d="M4 9.5h16M8.5 3v4M15.5 3v4" />
    <path {...a} d="M9.2 14.3l1.8 1.8 3.3-3.4" />
  </>,
  photos: (s) => <>
    <rect {...s} x={4} y={5} width={16} height={14} rx={2} />
    <circle {...s} cx={9} cy={10} r={1.6} />
    <path {...s} d="M5 18l4-4 2.5 2.5 3.5-3.5 4 4" />
  </>,
  review: (s) => <>
    <path {...s} d="M7 3.5V20.5" />
    <path {...s} d="M7 4.5h9.5l-2.2 3.2 2.2 3.3H7" />
  </>,
  safety: (s, a) => <>
    <path {...s} d="M12 3.2l7 2.6v5.2c0 4.4-3 7.3-7 8.8-4-1.5-7-4.4-7-8.8V5.8z" />
    <path {...a} d="M9 12l2 2 4-4.2" />
  </>,
  notes: (s, a) => <>
    <circle {...s} cx={11} cy={10.5} r={3.8} />
    <path {...s} d="M4.5 20a6.5 6.5 0 0 1 13 0" />
    <path {...a} d="M18.5 3.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" />
  </>,
  login: (s) => <>
    <circle {...s} cx={8} cy={8} r={3.5} />
    <path {...s} d="M10.5 10.5l8 8M15.5 15.5l2-2M18.5 18.5l1.7-1.7" />
  </>,
  call: (s) => <path {...s} d="M7 4.5C5.8 4.5 4.8 5.5 4.9 6.7c.5 7 5.4 11.9 12.4 12.4 1.2.1 2.2-.9 2.2-2.1v-2.3l-3.8-1.6-1.7 1.9c-2.3-1.2-4.1-3-5.3-5.3l1.9-1.7L9 4.5z" />,
  addPerson: (s, a) => <>
    <circle {...s} cx={12} cy={6.5} r={2.5} />
    <path {...s} d="M6 20v-1a6 6 0 0 1 12 0v1" />
    <path {...a} d="M12 11.5v4M10 13.5h4" />
  </>,
  back: (s) => <path {...s} d="M14.5 6l-6 6 6 6" />,
  forward: (s) => <path {...s} d="M9.5 6l6 6-6 6" />,
  close: (s) => <path {...s} d="M7 7l10 10M17 7L7 17" />,
  add: (s) => <path {...s} d="M12 5v14M5 12h14" />,
  check: (s) => <path {...s} d="M5 12.5l4.5 4.5L19 7" />,
  trash: (s) => <>
    <path {...s} d="M5 6.5h14" />
    <path {...s} d="M9.5 6.5V5.2A1.5 1.5 0 0 1 11 3.7h2a1.5 1.5 0 0 1 1.5 1.5V6.5" />
    <path {...s} d="M6.7 6.5l.8 11.5a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l.8-11.5" />
    <path {...s} d="M10 10.5v6M14 10.5v6" />
  </>,
  pin: (s) => <>
    <path {...s} d="M9 4h6l-1 5 3 2.6v1.4H7v-1.4L10 9z" />
    <path {...s} d="M12 14.6V20" />
  </>,
  block: (s) => <>
    <circle {...s} cx={12} cy={12} r={8} />
    <path {...s} d="M6.5 6.5l11 11" />
  </>,
  refresh: (s) => <>
    <path {...s} d="M5.5 11.5a6.5 6.5 0 0 1 11-4.3l1.8 1.6" />
    <path {...s} d="M18.5 12.5a6.5 6.5 0 0 1-11 4.3l-1.8-1.6" />
    <path {...s} d="M18.5 4.5v4.3h-4.3M5.5 19.5v-4.3h4.3" />
  </>,
  sparkle: (s, a) => <>
    <path {...a} d="M11 4l1.7 4.6 4.6 1.7-4.6 1.7L11 16.6 9.3 12 4.7 10.3 9.3 8.6z" />
    <path {...s} d="M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </>,
  hide: (s) => <>
    <path {...s} d="M4 12s3-6 8-6c1.4 0 2.7.4 3.8 1.1M20 12s-1.1 2.1-3.2 3.8" />
    <path {...s} d="M14.1 14a2.8 2.8 0 0 1-4.1-3.9" />
    <path {...s} d="M4.5 4.5l15 15" />
  </>,
  pending: (s) => <>
    <path {...s} d="M7 4h10M7 20h10" />
    <path {...s} d="M8 4v3l4 5 4-5V4M8 20v-3l4-5 4 5v3" />
  </>,
  tip: (s) => <>
    <path {...s} d="M9 16a5 5 0 1 1 6 0c-.7.5-1 1.2-1 2H10c0-.8-.3-1.5-1-2z" />
    <path {...s} d="M10 20h4M10.7 22h2.6" />
  </>,
};

function Icon({ name, size = 24, color = "#b388ff", accentColor = "#7c4dff", style }) {
  const s = { fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const a = { ...s, stroke: accentColor };
  const draw = ICON_PATHS[name];
  if (!draw) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {draw(s, a, color)}
    </svg>
  );
}

window.Icon = Icon;
window.ICON_NAMES = Object.keys(ICON_PATHS);

/* ---- Shared entrance system --------------------------------------
   State-driven (transition, not @keyframes) so a settled element
   always reports opacity:1 — survives screenshot/clone capture and
   prefers-reduced-motion. `mounted` comes from EntranceContext, which
   each screen resets on mount so the stagger replays on every switch. */
window.EntranceContext = React.createContext(true);

function enterStyle(motion, delay, mounted) {
  if (!motion || !motion.on) return {};
  return {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(16px)",
    transition: `opacity .7s cubic-bezier(.2,.7,.3,1) ${delay}ms, transform .7s cubic-bezier(.2,.7,.3,1) ${delay}ms`,
    willChange: "opacity, transform",
  };
}
window.enterStyle = enterStyle;

// hook: returns `mounted`, flips false→true shortly after (re)mount
window.useEntrance = function useEntrance() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setM(true), 50);
    return () => clearTimeout(id);
  }, []);
  return m;
};

// Static brand forget-me-not glyph (used in loaders, empty states, headers).
const FG_PETAL = "M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z";
window.FlowerGlyph = function FlowerGlyph({ size = 28, glow = false, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48"
      style={{ ...(glow ? { filter: "drop-shadow(0 0 8px rgba(124,77,255,0.5))" } : {}), ...style }}>
      <defs>
        <radialGradient id="fg-petal" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ddc8ff" />
          <stop offset="48%" stopColor="#9c6bff" />
          <stop offset="100%" stopColor="#7340d8" />
        </radialGradient>
        <radialGradient id="fg-eye" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="60%" stopColor="#f6c64f" />
          <stop offset="100%" stopColor="#e7a92f" />
        </radialGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={FG_PETAL} transform={`rotate(${i * 72} 24 24)`}
          fill="url(#fg-petal)" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.5" />
      ))}
      <circle cx="24" cy="24" r="4.5" fill="#fdfdff" />
      <circle cx="24" cy="24" r="2.8" fill="url(#fg-eye)" />
      <circle cx="24" cy="24" r="0.95" fill="#d89a2c" />
    </svg>
  );
};
