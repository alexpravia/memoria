/* memoria-flower-real.jsx — botanically faithful forget-me-not.
   Five broad, notched, overlapping petals + white/yellow eye + soft shading.
   Exports window.RealFlowerBoard. */

const R_BG = "#1a1a2e", R_SURF = "#2a2a4a", R_LAV = "#b388ff", R_LIGHT = "#e9deff";

/* one petal, symmetric about x=24, tip up with a gentle notch */
const PETAL = "M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z";

function RealFlowerDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <radialGradient id="fmn-blue" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#aed1f2" />
          <stop offset="48%" stopColor="#5e92d8" />
          <stop offset="100%" stopColor="#487ccb" />
        </radialGradient>
        <radialGradient id="fmn-peri" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cdd2f6" />
          <stop offset="48%" stopColor="#8a90e6" />
          <stop offset="100%" stopColor="#6c72d6" />
        </radialGradient>
        <radialGradient id="fmn-purple" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ddc8ff" />
          <stop offset="48%" stopColor="#9c6bff" />
          <stop offset="100%" stopColor="#7340d8" />
        </radialGradient>
        <radialGradient id="fmn-eye" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="60%" stopColor="#f6c64f" />
          <stop offset="100%" stopColor="#e7a92f" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function bloom(gradId) {
  return <>
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} transform={`rotate(${i * 72} 24 24)`} d={PETAL}
        fill={`url(#${gradId})`} stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.5" />
    ))}
    {/* soft crease down each petal for depth */}
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={"c" + i} transform={`rotate(${i * 72} 24 24)`} d="M24 20.5 L24 10.2"
        stroke="#1a1a3a" strokeOpacity="0.07" strokeWidth="1.5" strokeLinecap="round" />
    ))}
    {/* the eye: white ring → yellow corona → tiny throat */}
    <circle cx="24" cy="24" r="4.5" fill="#fdfdff" />
    <circle cx="24" cy="24" r="2.8" fill="url(#fmn-eye)" />
    <circle cx="24" cy="24" r="0.95" fill="#d89a2c" />
  </>;
}

const REAL_VARIANTS = {
  blue: {
    name: "True to life",
    blurb: "The authentic forget-me-not — sky-blue petals, white-and-gold eye.",
    grad: "fmn-blue", glow: "#5e92d8",
  },
  peri: {
    name: "Periwinkle bridge",
    blurb: "Real flower form nudged toward the brand — blue-violet, still natural.",
    grad: "fmn-peri", glow: "#8a90e6",
  },
  purple: {
    name: "Brand purple",
    blurb: "The exact botanical shape in Memoria’s palette — on-brand, still a real bloom.",
    grad: "fmn-purple", glow: "#7c4dff",
  },
};

const R_ORDER = ["blue", "peri", "purple"];

function RealFlowerSVG({ id, size, glow }) {
  const v = REAL_VARIANTS[id];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48"
      style={glow ? { filter: `drop-shadow(0 0 ${size * 0.12}px ${v.glow}aa)` } : undefined}>
      {bloom(v.grad)}
    </svg>
  );
}

function RealFlowerArtboard({ id }) {
  const v = REAL_VARIANTS[id];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: R_BG, display: "flex", flexDirection: "column", fontFamily: "-apple-system, system-ui, sans-serif" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #ffffff10" }}>
        <RealFlowerSVG id={id} size={140} glow />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 20px", borderBottom: "1px solid #ffffff10" }}>
        <div style={{ width: 66, height: 66, borderRadius: 16, background: "radial-gradient(120% 120% at 35% 25%, #2f2f5a, #15152a)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.4)", border: "1px solid #ffffff14" }}>
          <RealFlowerSVG id={id} size={46} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {[32, 24, 16].map((px) => (
            <div key={px} style={{ width: 38, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: R_SURF, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RealFlowerSVG id={id} size={px} />
              </div>
              <span style={{ fontSize: 9, color: "#6a6a85" }}>{px}px</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid #ffffff10" }}>
        <RealFlowerSVG id={id} size={34} />
        <span style={{ fontSize: 28, fontWeight: 700, color: R_LAV, letterSpacing: 0.4 }}>Memoria</span>
      </div>

      <div style={{ padding: "14px 20px 18px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: R_LIGHT, marginBottom: 4 }}>{v.name}</div>
        <div style={{ fontSize: 12.5, color: "#9a9ab0", lineHeight: 1.45 }}>{v.blurb}</div>
      </div>
    </div>
  );
}

function RealFlowerBoard() {
  return (
    <>
      <RealFlowerDefs />
      <DesignCanvas>
        <DCSection id="real" title="Forget-me-not — true to life" subtitle="Botanically faithful: notched overlapping petals + white-and-gold eye">
          {R_ORDER.map((id) => (
            <DCArtboard key={id} id={id} label={REAL_VARIANTS[id].name} width={300} height={480}>
              <RealFlowerArtboard id={id} />
            </DCArtboard>
          ))}
        </DCSection>
      </DesignCanvas>
    </>
  );
}

window.RealFlowerBoard = RealFlowerBoard;
