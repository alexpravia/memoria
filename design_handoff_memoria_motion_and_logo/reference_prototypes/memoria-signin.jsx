/* memoria-signin.jsx — Sign-in with explorable ambient backgrounds.
   window.SignInScreen({ motion, signinBg })
   motion = { on:boolean, amp:number (0..1.6), dur:number } */

const PURPLE = "#7c4dff", LAV = "#b388ff", FG = "#e0e0e0";

// ---- Ambient background variants ---------------------------------
function AuroraBG({ on, amp }) {
  const blobs = [
    { c: "#5e35b1", x: "18%", y: "22%", s: 320, anim: "m-drift-a", d: 26 },
    { c: "#7c4dff", x: "72%", y: "30%", s: 300, anim: "m-drift-b", d: 32 },
    { c: "#3a2a6a", x: "50%", y: "78%", s: 360, anim: "m-drift-c", d: 38 },
    { c: "#9c6bff", x: "82%", y: "72%", s: 220, anim: "m-drift-a", d: 30 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {blobs.map((b, i) => (
        <div key={i} style={{
          position: "absolute", left: b.x, top: b.y, width: b.s, height: b.s,
          marginLeft: -b.s / 2, marginTop: -b.s / 2, borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${b.c}, transparent 68%)`,
          filter: "blur(38px)",
          opacity: (0.32 + i * 0.02) * (on ? Math.min(1, 0.5 + amp * 0.5) : 0.55),
          animation: on ? `${b.anim} ${b.d / Math.max(amp, 0.4)}s ease-in-out infinite` : "none",
          willChange: "transform",
        }} />
      ))}
    </div>
  );
}

function OrbsBG({ on, amp }) {
  const orbs = React.useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    x: (i * 61) % 100, size: 5 + (i % 4) * 5, dur: 16 + (i % 7) * 3,
    delay: -(i * 2.3), op: 0.12 + (i % 5) * 0.06,
  })), []);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {orbs.map((o, i) => (
        <div key={i} style={{
          position: "absolute", left: `${o.x}%`, bottom: -20,
          width: o.size, height: o.size, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, #d8c2ff, ${PURPLE} 70%, transparent)`,
          boxShadow: `0 0 ${o.size * 1.6}px ${PURPLE}`,
          opacity: on ? o.op * Math.min(1.4, 0.6 + amp) : 0.18,
          animation: on ? `m-float-up ${o.dur / Math.max(amp, 0.4)}s linear ${o.delay}s infinite` : "none",
          willChange: "transform, opacity",
        }} />
      ))}
    </div>
  );
}

function ConstellationBG({ on, amp }) {
  const W = 402, H = 600;
  const nodes = React.useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    x: 40 + ((i * 97) % (W - 80)), y: 60 + ((i * 151) % (H - 120)),
    r: 1.6 + (i % 3) * 0.9, tw: 3 + (i % 5),
  })), []);
  const edges = [[0,1],[1,2],[2,4],[3,4],[4,5],[5,7],[6,7],[7,9],[8,9],[9,11],[10,11],[11,13],[2,6],[5,10],[1,8]];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", width: "140%", height: "120%",
        animation: on ? `m-rotate ${140 / Math.max(amp, 0.4)}s linear infinite` : "none",
        transformOrigin: "50% 50%",
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {edges.map(([a, b], i) => (
            <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
              stroke={LAV} strokeWidth="0.8" strokeOpacity={(on ? 0.18 : 0.12) * Math.min(1.3, 0.7 + amp)} />
          ))}
          {nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="#e9deff"
              style={{ animation: on ? `m-twinkle ${n.tw / Math.max(amp, 0.5)}s ease-in-out ${-i}s infinite` : "none",
                opacity: on ? undefined : 0.5 }} />
          ))}
        </svg>
      </div>
    </div>
  );
}

function SigninBackground({ variant, motion }) {
  const { on, amp } = motion;
  if (variant === "Aurora") return <AuroraBG on={on} amp={amp} />;
  if (variant === "Memory orbs") return <OrbsBG on={on} amp={amp} />;
  if (variant === "Constellation") return <ConstellationBG on={on} amp={amp} />;
  if (variant === "Aurora + Orbs") return <>
    <AuroraBG on={on} amp={amp} />
    <OrbsBG on={on} amp={amp * 0.8} />
  </>;
  // Blend (all three)
  return <>
    <AuroraBG on={on} amp={amp * 0.85} />
    <OrbsBG on={on} amp={amp * 0.7} />
    <ConstellationBG on={on} amp={amp * 0.55} />
  </>;
}

// ---- The forget-me-not brand mark that unfurls petal-by-petal on open ----
const PETAL = "M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z";

function BrandMark({ motion }) {
  const { on, amp } = motion;
  const spd = Math.max(amp, 0.5);
  const bloomDur = (0.9 / spd).toFixed(2);
  const fadeDur = (0.42 / spd).toFixed(2);
  return (
    <svg width="90" height="90" viewBox="0 0 48 48"
      style={{
        marginBottom: 10, transformOrigin: "center",
        filter: "drop-shadow(0 0 16px rgba(124,77,255,0.55))",
        animation: on ? `m-bloom ${bloomDur}s cubic-bezier(.34,1.42,.5,1) .1s both` : "none",
      }}>
      <defs>
        <radialGradient id="si-petal" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ddc8ff" />
          <stop offset="48%" stopColor="#9c6bff" />
          <stop offset="100%" stopColor="#7340d8" />
        </radialGradient>
        <radialGradient id="si-eye" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="60%" stopColor="#f6c64f" />
          <stop offset="100%" stopColor="#e7a92f" />
        </radialGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={PETAL} transform={`rotate(${i * 72} 24 24)`}
          fill="url(#si-petal)" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.5"
          style={{ animation: on ? `m-fade-in ${fadeDur}s ease ${(0.18 + i * 0.09 / spd).toFixed(2)}s both` : "none" }} />
      ))}
      <g style={{ animation: on ? `m-eye-pop ${(0.55 / spd).toFixed(2)}s ease ${(0.2 + 4 * 0.09 / spd).toFixed(2)}s both` : "none" }}>
        <circle cx="24" cy="24" r="4.5" fill="#fdfdff" />
        <circle cx="24" cy="24" r="2.8" fill="url(#si-eye)" />
        <circle cx="24" cy="24" r="0.95" fill="#d89a2c" />
      </g>
    </svg>
  );
}

function Field({ placeholder, secure, motion, delay }) {
  const [focus, setFocus] = React.useState(false);
  const [val, setVal] = React.useState("");
  const mounted = window.useEntrance();
  return (
    <div className="m-enter" style={window.enterStyle(motion, delay, mounted)}>
      <div style={{
        background: "#2a2a4a", borderRadius: 12, padding: "16px 18px",
        display: "flex", alignItems: "center",
        transition: "box-shadow .4s ease, background .4s ease, transform .4s ease",
        boxShadow: focus ? `0 0 0 2px ${PURPLE}, 0 0 22px rgba(124,77,255,0.45)` : "0 0 0 0 rgba(124,77,255,0)",
        background: focus ? "#30305a" : "#2a2a4a",
      }}>
        <input
          value={val} onChange={(e) => setVal(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          placeholder={placeholder} type={secure ? "password" : "text"}
          style={{
            border: "none", outline: "none", background: "transparent",
            color: "#fff", fontSize: 18, width: "100%",
            fontFamily: "inherit",
          }} />
      </div>
    </div>
  );
}

function SignInScreen({ motion, signinBg }) {
  const [pressed, setPressed] = React.useState(false);
  const mounted = window.useEntrance();
  const ent = (delay) => window.enterStyle(motion, delay, mounted);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", overflow: "hidden" }}>
      <SigninBackground variant={signinBg} motion={motion} />
      {/* vignette for depth */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 50% 30%, transparent 40%, rgba(12,12,28,0.55))", pointerEvents: "none" }} />

      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "0 40px", zIndex: 2,
      }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div className="m-enter" style={{ ...ent(0), display: "flex", justifyContent: "center" }}>
            <BrandMark motion={motion} />
          </div>
          <div className="m-enter" style={ent(120)}>
            <div style={{
              fontSize: 48, fontWeight: 700, color: LAV, letterSpacing: 0.5,
              textShadow: motion.on ? undefined : "0 0 18px rgba(179,136,255,0.35)",
              animation: motion.on ? `m-glow ${6 / Math.max(motion.amp, 0.4)}s ease-in-out infinite` : "none",
            }}>Memoria</div>
          </div>
          <div className="m-enter" style={{ ...ent(220), fontSize: 20, color: FG, marginTop: 8 }}>
            Welcome back
          </div>
        </div>

        <Field placeholder="Email" motion={motion} delay={340} />
        <div style={{ height: 16 }} />
        <Field placeholder="Password" secure motion={motion} delay={420} />

        <div className="m-enter" style={ent(520)}>
          <button
            onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            style={{
              position: "relative", overflow: "hidden", width: "100%", border: "none",
              background: PURPLE, borderRadius: 12, padding: "18px 0", marginTop: 26, marginBottom: 18,
              cursor: "pointer", transition: "transform .18s cubic-bezier(.34,1.56,.64,1), filter .2s",
              transform: pressed ? "scale(0.965)" : "scale(1)",
              filter: pressed ? "brightness(0.92)" : "brightness(1)",
            }}>
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 600, position: "relative", zIndex: 1 }}>Log In</span>
            {motion.on && (
              <span style={{
                position: "absolute", top: 0, bottom: 0, width: "55%",
                background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.28), transparent)",
                animation: `m-shimmer ${4.5 / Math.max(motion.amp, 0.4)}s ease-in-out 1.2s infinite`,
              }} />
            )}
          </button>
        </div>

        <div className="m-enter" style={{ ...ent(600), textAlign: "center" }}>
          <span style={{ color: LAV, fontSize: 16 }}>Don't have an account? Sign Up</span>
        </div>
      </div>
    </div>
  );
}

// (entrance helper now shared from memoria-icons.jsx as window.enterStyle)

window.SignInScreen = SignInScreen;
