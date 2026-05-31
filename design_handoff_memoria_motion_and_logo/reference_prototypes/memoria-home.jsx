/* memoria-home.jsx — Co-user home: staggered card entrance + press feedback.
   window.HomeScreen({ motion }) */

const H_PURPLE = "#7c4dff", H_LAV = "#b388ff", H_FG = "#e0e0e0", H_SURF = "#2a2a4a";

const CARDS = [
  { icon: "sparkle", label: "Generate Today's Briefing", sub: "AI-assembled · ready to review", primary: true },
  { icon: "photos", label: "Photos", sub: "128 · 3 pending" },
  { icon: "contacts", label: "People", sub: "12 people" },
  { icon: "calendar", label: "Events", sub: "2 this week" },
  { icon: "notes", label: "Memo's Notes", sub: "34 learned facts" },
  { icon: "review", label: "Review Queue", sub: "3 to review", badge: 3 },
  { icon: "safety", label: "Safety & Filters", sub: "Sensitivity settings" },
];

function HomeScreen({ motion }) {
  const { on } = motion;
  const mounted = window.useEntrance();
  const ent = (delay) => window.enterStyle(motion, delay, mounted);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", overflow: "auto" }}>
      <div style={{ padding: "64px 22px 28px" }}>
        {/* header */}
        <div className="m-enter" style={ent(0)}>
          <div style={{ fontSize: 15, color: H_LAV, fontWeight: 600, letterSpacing: 0.3 }}>Helper dashboard</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: H_FG, marginTop: 4 }}>Margaret's Memoria</div>
        </div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {CARDS.map((c, idx) => (
            <ActionCard key={c.label} card={c} motion={motion} delay={140 + idx * 70} />
          ))}
        </div>

        <div className="m-enter" style={{ ...ent(140 + CARDS.length * 70), marginTop: 18 }}>
          <PressBtn motion={motion} style={{
            width: "100%", background: "transparent", border: "2px solid #ff6b6b",
            borderRadius: 16, padding: "15px 0",
          }}>
            <span style={{ color: "#ff6b6b", fontSize: 17, fontWeight: 600 }}>Sign Out</span>
          </PressBtn>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ card, motion, delay }) {
  const mounted = window.useEntrance();
  const enter = window.enterStyle(motion, delay, mounted);
  return (
    <div className="m-enter" style={enter}>
      <PressBtn motion={motion} style={{
        width: "100%", textAlign: "left",
        background: card.primary ? H_PURPLE : H_SURF,
        borderRadius: 16, padding: "18px 18px",
        display: "flex", alignItems: "center", gap: 16,
        boxShadow: card.primary && motion.on ? "0 10px 30px rgba(124,77,255,0.35)" : "none",
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: card.primary ? "rgba(255,255,255,0.18)" : "#22223a",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}>
          <Icon name={card.icon} size={26}
            color={card.primary ? "#fff" : H_LAV}
            accentColor={card.primary ? "#fff" : H_PURPLE} />
          {card.badge && (
            <span style={{
              position: "absolute", top: -5, right: -5, minWidth: 20, height: 20, padding: "0 5px",
              borderRadius: 10, background: "#ff6b6b", color: "#fff", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: motion.on ? `m-breathe ${3 / Math.max(motion.amp, 0.5)}s ease-in-out infinite` : "none",
            }}>{card.badge}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: card.primary ? "#fff" : H_FG }}>{card.label}</div>
          <div style={{ fontSize: 14, color: card.primary ? "rgba(255,255,255,0.8)" : "#9a9ab0", marginTop: 2 }}>{card.sub}</div>
        </div>
        <Icon name="forward" size={20} color={card.primary ? "rgba(255,255,255,0.7)" : "#6a6a85"} />
      </PressBtn>
    </div>
  );
}

window.HomeScreen = HomeScreen;
