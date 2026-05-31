/* memoria-emergency.jsx — Emergency identity card. Calm, grounding motion.
   window.EmergencyScreen({ motion, callButton }) */

const E_PURPLE = "#7c4dff", E_LAV = "#b388ff", E_FG = "#e0e0e0", E_SURF = "#2a2a4a", E_WHITE = "#fff";

function EmergencyScreen({ motion, callButton }) {
  const mounted = window.useEntrance();
  const { on, amp } = motion;

  // calm staggered reveal of each label/value pair
  const reveal = (delay) => on ? {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(10px)",
    transition: `opacity .7s ease ${delay}ms, transform .7s cubic-bezier(.2,.7,.3,1) ${delay}ms`,
  } : {};

  return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 36 }}>
      {/* identity icon with a slow reassuring heartbeat halo */}
      <div style={{ position: "relative", width: 72, height: 72, marginBottom: 28 }}>
        {on && [0, 1].map((i) => (
          <span key={i} style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,77,255,0.5), transparent 70%)",
            animation: `m-halo ${4 / Math.max(amp, 0.5)}s ease-out ${i * (2 / Math.max(amp, 0.5))}s infinite`,
          }} />
        ))}
        <div style={{
          position: "relative", width: 72, height: 72, borderRadius: "50%", background: E_SURF,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="whoAmI" size={32} color={E_LAV} />
        </div>
      </div>

      {/* the card — protective accent border with a very slow breathing glow */}
      <div style={{
        width: "100%", background: E_SURF, borderRadius: 20, padding: 30,
        border: `3px solid ${E_PURPLE}`,
        animation: on ? `m-border-glow ${6 / Math.max(amp, 0.5)}s ease-in-out infinite` : "none",
        ...(on ? { opacity: mounted ? 1 : 0, transform: mounted ? "scale(1)" : "scale(0.97)", transition: "opacity .8s ease, transform .8s cubic-bezier(.2,.7,.3,1)" } : {}),
      }}>
        <div style={reveal(150)}>
          <div style={lbl}>MY NAME IS</div>
          <div style={val}>Margaret Hale</div>
        </div>
        <div style={reveal(280)}>
          <div style={lbl}>I LIVE IN</div>
          <div style={val}>Eugene, Oregon</div>
        </div>
        <div style={reveal(410)}>
          <div style={lbl}>MY EMERGENCY CONTACT</div>
          <div style={{ ...val, fontSize: 24 }}>Eleanor Hale</div>
          <div style={{ fontSize: 18, color: E_FG, marginTop: 4 }}>(Daughter)</div>
          <div style={{ fontSize: 20, color: E_PURPLE, marginTop: 8, fontWeight: 600, letterSpacing: 1 }}>(503) 555-0142</div>
        </div>
      </div>

      {/* proposed: a gently pulsing call affordance */}
      {callButton !== false && (
        <div style={{ width: "100%", ...reveal(560) }}>
          <PressBtn motion={motion} style={{
            width: "100%", marginTop: 22, background: E_PURPLE, borderRadius: 16,
            padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            animation: on ? `m-breathe ${3.2 / Math.max(amp, 0.5)}s ease-in-out infinite` : "none",
            boxShadow: on ? "0 8px 26px rgba(124,77,255,0.4)" : "none",
          }}>
            <Icon name="call" size={22} color="#fff" />
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 600 }}>Call Eleanor</span>
          </PressBtn>
        </div>
      )}
    </div>
  );
}

const lbl = { fontSize: 14, fontWeight: 700, color: E_LAV, letterSpacing: 2, marginTop: 18, marginBottom: 4 };
const val = { fontSize: 28, fontWeight: 700, color: E_WHITE };

window.EmergencyScreen = EmergencyScreen;
