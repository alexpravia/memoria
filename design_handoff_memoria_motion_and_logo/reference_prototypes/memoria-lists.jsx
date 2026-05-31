/* memoria-lists.jsx — A list screen with three living states:
   loaded (staggered rows), loading (breathing chevron), empty (check draws on).
   window.ListScreen({ motion }) — has its own little state switcher. */

const L_PURPLE = "#7c4dff", L_LAV = "#b388ff", L_FG = "#e0e0e0", L_SURF = "#2a2a4a";

const NOTES = [
  { fact: "Prefers to be called Maggie by close family", status: "pinned" },
  { fact: "Was a schoolteacher for 31 years in Eugene", status: "active" },
  { fact: "Loves Ella Fitzgerald and big-band jazz", status: "active" },
  { fact: "Allergic to penicillin", status: "pinned" },
  { fact: "Doesn't like to talk about the move from the farm", status: "suppressed" },
  { fact: "Her late husband was named Walter", status: "active" },
];

function BreathingMark({ motion, size = 64 }) {
  const { on, amp } = motion;
  return (
    <div style={{
      animation: on ? `m-breathe ${2.6 / Math.max(amp, 0.5)}s ease-in-out infinite` : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: "radial-gradient(circle at 50% 45%, rgba(124,77,255,0.35), transparent 70%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: on ? "0 0 30px rgba(124,77,255,0.4)" : "none",
      }}>
        <Icon name="mark" size={size * 0.5} color={L_LAV} />
      </div>
    </div>
  );
}

function LoadingState({ motion }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
      <BreathingMark motion={motion} />
      <div style={{ color: L_LAV, fontSize: 18, opacity: 0.9,
        animation: motion.on ? `m-glow ${2.4 / Math.max(motion.amp, 0.5)}s ease-in-out infinite` : "none" }}>
        Gathering Memo's notes…
      </div>
    </div>
  );
}

function EmptyState({ motion }) {
  const { on } = motion;
  const len = 26;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
      <div style={{
        width: 96, height: 96, borderRadius: "50%", background: "rgba(76,175,80,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
        animation: on ? "m-float 5s ease-in-out infinite" : "none",
      }}>
        {/* settle particles */}
        {on && [0,1,2,3,4,5].map((i) => (
          <span key={i} style={{
            position: "absolute", width: 5, height: 5, borderRadius: "50%", background: "#4caf50",
            left: "50%", top: "50%",
            animation: `m-settle 1.4s ease-out ${0.5 + i * 0.05}s both`,
            transform: `rotate(${i * 60}deg) translateY(-46px)`,
          }} />
        ))}
        <svg width="52" height="52" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#4caf50" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={len} strokeDashoffset={on ? len : 0}
            style={{ animation: on ? "m-draw 0.7s cubic-bezier(.5,0,.2,1) .3s forwards" : "none" }} />
        </svg>
      </div>
      <div style={{ color: L_FG, fontSize: 20, fontWeight: 600 }}>All caught up</div>
      <div style={{ color: "#9a9ab0", fontSize: 16, textAlign: "center" }}>No notes need your review right now.</div>
    </div>
  );
}

function NoteRow({ note, motion, delay, onRemove, leaving }) {
  const { on } = motion;
  const mounted = window.useEntrance();
  const statusIcon = { pinned: "pin", suppressed: "block", active: null }[note.status];
  const enter = leaving ? {} : window.enterStyle(motion, delay, mounted);
  const leave = leaving ? { animation: "m-leave .45s cubic-bezier(.4,0,1,.6) both" } : {};
  return (
    <div className="m-enter" style={{ ...enter, ...leave }}>
      <div style={{ background: L_SURF, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: L_LAV, fontWeight: 700 }}>Learned fact</span>
          {statusIcon && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#999", fontSize: 12, fontStyle: "italic" }}>
              <Icon name={statusIcon} size={13} color="#999" />
              {note.status[0].toUpperCase() + note.status.slice(1)}
            </span>
          )}
        </div>
        <div style={{ color: L_FG, fontSize: 16, lineHeight: 1.45, marginBottom: 14 }}>{note.fact}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ ic: "pin", t: note.status === "pinned" ? "Unpin" : "Pin", c: L_LAV },
            { ic: "block", t: note.status === "suppressed" ? "Restore" : "Suppress", c: L_LAV },
            { ic: "trash", t: "Delete", c: "#ff6b6b", del: true }].map((b) => (
            <PressBtn key={b.t} motion={motion} onClick={b.del ? onRemove : undefined} style={{
              flex: 1, background: "#22223a", borderRadius: 8, padding: "10px 6px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
              <Icon name={b.ic} size={15} color={b.c} />
              <span style={{ color: b.c, fontSize: 13, fontWeight: 600 }}>{b.t}</span>
            </PressBtn>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListScreen({ motion }) {
  const [state, setState] = React.useState("loaded"); // loaded | loading | empty
  const [notes, setNotes] = React.useState(NOTES);
  const [leavingIdx, setLeavingIdx] = React.useState(null);

  // when switched to loading, auto-advance to loaded to show the transition
  React.useEffect(() => {
    if (state === "loading") {
      const t = setTimeout(() => { setNotes(NOTES); setState("loaded"); }, 2200);
      return () => clearTimeout(t);
    }
  }, [state]);

  const removeAt = (idx) => {
    setLeavingIdx(idx);
    setTimeout(() => {
      setNotes((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        if (next.length === 0) setState("empty");
        return next;
      });
      setLeavingIdx(null);
    }, 450);
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", overflow: "auto" }}>
      <div style={{ padding: "64px 20px 28px", minHeight: "100%", position: "relative" }}>
        <div style={{ fontSize: 15, color: L_LAV, fontWeight: 600 }}>Helper dashboard</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: L_FG, marginTop: 4, marginBottom: 16 }}>Memo's Notes</div>

        {/* state switcher (preview affordance) */}
        <div style={{ display: "flex", gap: 6, background: "#22223a", borderRadius: 12, padding: 4, marginBottom: 18 }}>
          {["loaded", "loading", "empty"].map((s) => (
            <button key={s} onClick={() => { if (s === "loaded") setNotes(NOTES); setState(s); }}
              style={{
                flex: 1, border: "none", cursor: "pointer", borderRadius: 9, padding: "9px 0",
                background: state === s ? L_PURPLE : "transparent",
                color: state === s ? "#fff" : "#9a9ab0", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                transition: "background .25s, color .25s",
              }}>
              {s === "loaded" ? "Loaded" : s === "loading" ? "Loading" : "Empty"}
            </button>
          ))}
        </div>

        {state === "loading" && <div style={{ position: "relative", height: 360 }}><LoadingState motion={motion} /></div>}
        {state === "empty" && <div style={{ position: "relative", height: 360 }}><EmptyState motion={motion} /></div>}
        {state === "loaded" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((n, idx) => (
              <NoteRow key={n.fact} note={n} motion={motion} delay={idx * 75}
                leaving={leavingIdx === idx} onRemove={() => removeAt(idx)} />
            ))}
            {notes.length > 0 && (
              <div style={{ textAlign: "center", color: "#6a6a85", fontSize: 13, marginTop: 6 }}>
                Tip: tap Delete to watch a row animate out
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

window.ListScreen = ListScreen;
