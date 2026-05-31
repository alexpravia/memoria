/* memoria-briefing.jsx — the daily briefing deck, brought to life.
   window.BriefingScreen({ motion, kenBurns, speakingRing }) */

const B_PURPLE = "#7c4dff", B_LAV = "#b388ff", B_FG = "#e0e0e0";

// Soft-focus "photo" placeholders — warm gradient portraits so Ken Burns
// has something living to move across (no external assets needed).
const PHOTOS = {
  dawn:   "radial-gradient(120% 100% at 30% 25%, #ffd9a8, #f0a868 38%, #b9657a 72%, #5e3a6e)",
  person: "radial-gradient(90% 90% at 50% 38%, #f6c9b0, #c98a86 45%, #6d5891 80%, #2e2a55)",
  memory: "radial-gradient(120% 100% at 65% 30%, #ffe6b8, #e0a06a 40%, #9a6a8c 75%, #3d3a6a)",
  garden: "radial-gradient(110% 100% at 40% 30%, #cfe8b0, #8fc08a 42%, #5e8f9c 75%, #344a6e)",
  dusk:   "radial-gradient(120% 100% at 50% 30%, #ffc9c0, #c98ab0 45%, #7c5aa8 78%, #2e2a55)",
};

const SLIDES = [
  { kind: "greeting", photo: "dawn",  text: "Good Morning, Margaret", sub: "Today is Saturday, May 30th, 2026", tint: "#3a2f5e" },
  { kind: "person",   photo: "person", text: "Eleanor", sub: "Your daughter\nShe visits every Sunday\nLives in Portland", tint: "#3a2a4e" },
  { kind: "memory",   photo: "memory", text: "A memory from your life", sub: "Summer at the lake house, 1998 — you taught the grandchildren to swim", tint: "#4a3a3a" },
  { kind: "memory",   photo: "garden", text: "Something to remember", sub: "Your garden in June. You grew tomatoes and roses every year.", tint: "#33452f" },
  { kind: "events",   photo: "dusk",  text: "Coming up this week", sub: "Tuesday: Dr. Lewis at 2pm\nThursday: Eleanor visits", tint: "#352f5e" },
  { kind: "closing",  photo: "dawn",  text: "That's your briefing for today", sub: "Have a wonderful day!", tint: "#3a2f5e" },
];

function SpeakingRing({ size, on, ringOn, amp }) {
  if (!ringOn) return null;
  return (
    <>
      {on && [0, 1, 2].map((i) => (
        <span key={i} style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `2px solid ${B_PURPLE}`,
          animation: `m-pulse-ring ${2.6 / Math.max(amp, 0.5)}s ease-out ${i * (0.85 / Math.max(amp, 0.5))}s infinite`,
        }} />
      ))}
    </>
  );
}

function BriefingScreen({ motion, kenBurns, speakingRing }) {
  const [i, setI] = React.useState(0);
  const [speaking, setSpeaking] = React.useState(true);
  const [shown, setShown] = React.useState(false);
  const slide = SLIDES[i];
  const { on, amp } = motion;

  // simulate the narration finishing after a while; replay slide entrance
  React.useEffect(() => {
    setSpeaking(true);
    setShown(false);
    const r = setTimeout(() => setShown(true), 50);
    const t = setTimeout(() => setSpeaking(false), 4200);
    return () => { clearTimeout(t); clearTimeout(r); };
  }, [i]);

  const go = (d) => setI((p) => Math.max(0, Math.min(SLIDES.length - 1, p + d)));
  const pct = ((i + 1) / SLIDES.length) * 100;
  const kbName = ["m-kenburns-a", "m-kenburns-b", "m-kenburns-c"][i % 3];

  return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", overflow: "hidden" }}>
      {/* section ambient tint, cross-fades on slide change */}
      <div key={"tint" + i} style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(120% 90% at 50% 20%, ${slide.tint}, #1a1a2e 70%)`,
        opacity: on ? 0 : 0.85,
        animation: on ? "m-tint-in 1.1s ease forwards" : "none",
      }} />

      {/* progress bar */}
      <div style={{ position: "absolute", top: 60, left: 32, right: 32, height: 6, background: "#2a2a4a", borderRadius: 3, zIndex: 5 }}>
        <div style={{
          height: 6, width: `${pct}%`, borderRadius: 3, background: B_PURPLE,
          transition: "width .7s cubic-bezier(.4,0,.2,1)",
          boxShadow: on ? `0 0 10px ${B_PURPLE}` : "none",
        }} />
      </div>

      {/* exit */}
      <div style={{
        position: "absolute", top: 80, right: 20, width: 44, height: 44, borderRadius: 22,
        background: "#2a2a4a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 6,
      }}>
        <Icon name="close" size={20} color="#ff6b6b" />
      </div>

      {/* slide content */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 32px", zIndex: 3 }}>
        <div style={on ? {
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0) scale(1)" : "translateY(22px) scale(0.985)",
          transition: "opacity .65s cubic-bezier(.2,.7,.3,1), transform .65s cubic-bezier(.2,.7,.3,1)",
        } : {}}>
          {/* photo with Ken Burns */}
          <div style={{
            width: "100%", aspectRatio: "4 / 3", borderRadius: 16, overflow: "hidden",
            marginBottom: 24, background: "#000", position: "relative",
            boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              position: "absolute", inset: 0, background: PHOTOS[slide.photo],
              transformOrigin: "center",
              animation: (on && kenBurns) ? `${kbName} ${16 / Math.max(amp, 0.5)}s ease-in-out infinite alternate` : "none",
              willChange: "transform",
            }} />
            {/* soft grain / light leak */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 70% 10%, rgba(255,240,210,0.25), transparent 50%)", mixBlendMode: "screen" }} />
          </div>

          <div style={{ fontSize: 32, fontWeight: 700, color: B_FG, textAlign: "center", marginBottom: 14, lineHeight: 1.15 }}>
            {slide.text}
          </div>
          {slide.sub && (
            <div style={{ fontSize: 20, color: B_LAV, textAlign: "center", lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {slide.sub}
            </div>
          )}
        </div>
      </div>

      {/* controls */}
      <div style={{
        position: "absolute", left: 24, right: 24, bottom: 28, zIndex: 6,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <PressBtn onClick={() => go(-1)} disabled={i === 0} motion={motion}
          style={{ background: "#2a2a4a", padding: "16px 26px", borderRadius: 14, opacity: i === 0 ? 0.3 : 1 }}>
          <span style={{ color: B_FG, fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="back" size={20} color={B_FG} /> Back
          </span>
        </PressBtn>

        <div style={{ position: "relative", width: 60, height: 60 }}>
          <SpeakingRing on={speaking && on} ringOn={speakingRing} amp={amp} />
          <PressBtn onClick={() => setSpeaking(true)} motion={motion}
            style={{
              width: 60, height: 60, borderRadius: 30, background: B_PURPLE,
              display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
            }}>
            <Icon name="listen" size={26} color="#fff" />
          </PressBtn>
        </div>

        <PressBtn onClick={() => go(1)} disabled={i === SLIDES.length - 1} motion={motion}
          style={{ background: "#2a2a4a", padding: "16px 26px", borderRadius: 14, opacity: i === SLIDES.length - 1 ? 0.5 : 1 }}>
          <span style={{ color: B_FG, fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {i === SLIDES.length - 1 ? "Done" : "Next"} <Icon name="forward" size={20} color={B_FG} />
          </span>
        </PressBtn>
      </div>
    </div>
  );
}

// shared press-feedback button (scale spring)
function PressBtn({ children, onClick, disabled, style, motion }) {
  const [p, setP] = React.useState(false);
  const fb = motion.on && motion.pressFeedback !== false;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={() => setP(true)} onMouseUp={() => setP(false)} onMouseLeave={() => setP(false)}
      disabled={disabled}
      style={{
        border: "none", cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
        transition: "transform .16s cubic-bezier(.34,1.56,.64,1), filter .18s",
        transform: (fb && p && !disabled) ? "scale(0.94)" : "scale(1)",
        filter: (p && !disabled) ? "brightness(0.93)" : "brightness(1)",
        ...style,
      }}>
      {children}
    </button>
  );
}

window.BriefingScreen = BriefingScreen;
window.PressBtn = PressBtn;
