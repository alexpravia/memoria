/* memoria-forms.jsx — co-user form-style screens, brought to life.
   Edit Person (form) · Sensitivity Filters (toggles + slider) · Briefing Preview.
   Exports window.FormScreen, FiltersScreen, PreviewScreen. */

const FM_BG = "#1a1a2e", FM_SURF = "#2a2a4a", FM_SUNK = "#22223a", FM_RAISE = "#3a3a5a";
const FM_PURPLE = "#7c4dff", FM_LAV = "#b388ff", FM_FG = "#e0e0e0", FM_MUTE = "#9a9ab0";

const fmRise = (motion, delay) => motion.on ? { animation: `m-rise .55s cubic-bezier(.2,.7,.3,1) ${delay}ms both` } : {};

function FormField({ label, value, placeholder, motion, delay, multiline }) {
  const [focus, setFocus] = React.useState(false);
  const [v, setV] = React.useState(value || "");
  return (
    <div className="m-enter" style={{ ...fmRise(motion, delay), marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: FM_LAV, marginBottom: 7 }}>{label}</div>
      <div style={{
        background: focus ? "#30305a" : FM_SURF, borderRadius: 12, padding: multiline ? "14px 16px" : "15px 16px",
        transition: "box-shadow .35s ease, background .35s ease",
        boxShadow: focus ? `0 0 0 2px ${FM_PURPLE}, 0 0 20px rgba(124,77,255,0.4)` : "0 0 0 0 rgba(124,77,255,0)",
      }}>
        {multiline ? (
          <textarea value={v} onChange={(e) => setV(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            placeholder={placeholder} rows={3}
            style={{ border: "none", outline: "none", background: "transparent", color: "#fff", fontSize: 16, width: "100%", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
        ) : (
          <input value={v} onChange={(e) => setV(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            placeholder={placeholder}
            style={{ border: "none", outline: "none", background: "transparent", color: "#fff", fontSize: 17, width: "100%", fontFamily: "inherit" }} />
        )}
      </div>
    </div>
  );
}

function Switch({ on, motion, onToggle }) {
  return (
    <PressBtn motion={motion} onClick={onToggle}
      style={{ width: 50, height: 30, borderRadius: 15, background: on ? FM_PURPLE : FM_RAISE, padding: 0, position: "relative", transition: "background .25s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: "#fff", transition: "left .28s cubic-bezier(.34,1.56,.64,1)", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
    </PressBtn>
  );
}

function ToggleRow({ title, sub, on, motion, delay, onToggle }) {
  return (
    <div className="m-enter" style={{ ...fmRise(motion, delay), marginBottom: 12 }}>
      <div style={{ background: FM_SURF, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16.5, fontWeight: 600, color: FM_FG }}>{title}</div>
          <div style={{ fontSize: 13, color: FM_MUTE, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
        </div>
        <Switch on={on} motion={motion} onToggle={onToggle} />
      </div>
    </div>
  );
}

const SaveButton = ({ label, motion, delay }) => (
  <div className="m-enter" style={fmRise(motion, delay)}>
    <PressBtn motion={motion} style={{ position: "relative", overflow: "hidden", width: "100%", background: FM_PURPLE, borderRadius: 14, padding: "16px 0", marginTop: 8 }}>
      <span style={{ color: "#fff", fontSize: 18, fontWeight: 600, position: "relative", zIndex: 1 }}>{label}</span>
      {motion.on && (
        <span style={{ position: "absolute", top: 0, bottom: 0, width: "55%", background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.25), transparent)", animation: `m-shimmer ${5 / Math.max(motion.amp, 0.5)}s ease-in-out 1s infinite` }} />
      )}
    </PressBtn>
  </div>
);

/* ---------------- Edit Person (form) ---------------- */
function FormScreen({ motion }) {
  const [brief, setBrief] = React.useState(true);
  return (
    <Scroll>
      <CoHeader title="Edit Person" sub="Eleanor — Margaret's daughter" motion={motion} />
      <div style={{ marginTop: 20 }}>
        <div className="m-enter" style={{ ...fmRise(motion, 90), display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <div style={{ width: 84, height: 84, borderRadius: 42, background: "linear-gradient(135deg, #7c4dff, #b388ff)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: motion.on ? "0 8px 24px rgba(124,77,255,0.4)" : "none" }}>
            <span style={{ color: "#fff", fontSize: 34, fontWeight: 700 }}>E</span>
          </div>
        </div>
        <FormField label="Name" value="Eleanor" motion={motion} delay={150} />
        <FormField label="Relationship" value="Daughter" motion={motion} delay={210} />
        <FormField label="How they're connected" value="Visits every Sunday. Lives in Portland with her two children." motion={motion} delay={270} multiline />
        <ToggleRow title="Include in daily briefings" sub="Memo will mention Eleanor in Margaret's morning briefing." on={brief} motion={motion} delay={330} onToggle={() => setBrief((b) => !b)} />
        <SaveButton label="Save changes" motion={motion} delay={400} />
      </div>
    </Scroll>
  );
}

/* ---------------- Sensitivity Filters ---------------- */
function Slider({ value, motion }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ position: "relative", height: 6, background: FM_SUNK, borderRadius: 3 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: 6, width: `${value * 100}%`, borderRadius: 3, background: FM_PURPLE, transition: "width .5s cubic-bezier(.4,0,.2,1)", boxShadow: motion.on ? `0 0 10px ${FM_PURPLE}` : "none" }} />
        <span style={{ position: "absolute", top: "50%", left: `${value * 100}%`, width: 20, height: 20, borderRadius: 10, background: "#fff", transform: "translate(-50%, -50%)", transition: "left .5s cubic-bezier(.4,0,.2,1)", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontSize: 13, color: FM_MUTE }}>Gentle</span>
        <span style={{ fontSize: 13, color: FM_MUTE }}>Full detail</span>
      </div>
    </div>
  );
}

function FiltersScreen({ motion }) {
  const [t1, setT1] = React.useState(true);
  const [t2, setT2] = React.useState(true);
  const [t3, setT3] = React.useState(false);
  const [lvl, setLvl] = React.useState(0.35);
  return (
    <Scroll>
      <CoHeader title="Sensitivity Filters" sub="What Memo gently holds back" motion={motion} />
      <div style={{ marginTop: 20 }}>
        <ToggleRow title="Soften upsetting news" sub="Skip distressing current events in briefings." on={t1} motion={motion} delay={110} onToggle={() => setT1((v) => !v)} />
        <ToggleRow title="Avoid the topic of moving" sub="Don't bring up the recent move to assisted living." on={t2} motion={motion} delay={170} onToggle={() => setT2((v) => !v)} />
        <ToggleRow title="Skip medical details" sub="Keep health specifics out of casual conversation." on={t3} motion={motion} delay={230} onToggle={() => setT3((v) => !v)} />

        <div className="m-enter" style={{ ...fmRise(motion, 300), marginTop: 8 }}>
          <div style={{ background: FM_SURF, borderRadius: 14, padding: "16px 16px" }}>
            <div style={{ fontSize: 16.5, fontWeight: 600, color: FM_FG }}>Detail level</div>
            <div style={{ fontSize: 13, color: FM_MUTE, margintop: 3, marginBottom: 16 }}>How much Memo shares when Margaret asks.</div>
            <Slider value={lvl} motion={motion} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {[["Gentle", 0.2], ["Balanced", 0.5], ["Full", 0.85]].map(([lbl, v]) => (
                <PressBtn key={lbl} motion={motion} onClick={() => setLvl(v)} style={{ flex: 1, background: Math.abs(lvl - v) < 0.05 ? FM_PURPLE : FM_SUNK, borderRadius: 9, padding: "8px 0" }}>
                  <span style={{ color: Math.abs(lvl - v) < 0.05 ? "#fff" : FM_MUTE, fontWeight: 600, fontSize: 13 }}>{lbl}</span>
                </PressBtn>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Scroll>
  );
}

/* ---------------- Briefing Preview (generate) ---------------- */
const BRIEF_LINES = [
  "Good morning greeting for Margaret",
  "Eleanor visits this Sunday",
  "A memory: the lake house, summer 1998",
  "Reminder: Dr. Lewis on Tuesday at 2pm",
  "A warm closing note",
];

function ShimmerBar({ w }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", height: 16, borderRadius: 8, background: FM_SUNK, width: w, marginBottom: 14 }}>
      <span style={{ position: "absolute", top: 0, bottom: 0, width: "60%", background: "linear-gradient(105deg, transparent, rgba(179,136,255,0.25), transparent)", animation: "m-shimmer 1.4s ease-in-out infinite" }} />
    </div>
  );
}

function PreviewScreen({ motion }) {
  const [state, setState] = React.useState("idle"); // idle | loading | done
  const generate = () => {
    setState("loading");
    setTimeout(() => setState("done"), 1500);
  };
  return (
    <Scroll>
      <CoHeader title="Briefing Preview" sub="Assemble Margaret's morning briefing" motion={motion} />

      <div className="m-enter" style={{ ...fmRise(motion, 110), marginTop: 18 }}>
        <PressBtn motion={motion} onClick={generate}
          style={{ width: "100%", background: FM_PURPLE, borderRadius: 14, padding: "16px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 10, boxShadow: motion.on ? "0 10px 26px rgba(124,77,255,0.32)" : "none" }}>
          {state === "loading"
            ? <FlowerGlyph size={22} style={{ animation: motion.on ? `m-breathe ${1.4}s ease-in-out infinite` : "none" }} />
            : <Icon name={state === "done" ? "refresh" : "sparkle"} size={20} color="#fff" accentColor="#fff" />}
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>
            {state === "loading" ? "Assembling…" : state === "done" ? "Regenerate briefing" : "Generate briefing"}
          </span>
        </PressBtn>
      </div>

      <div style={{ marginTop: 18 }}>
        {state === "idle" && (
          <div style={{ background: FM_SURF, borderRadius: 16, padding: "22px 18px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><FlowerGlyph size={40} glow /></div>
            <div style={{ fontSize: 15, color: FM_MUTE, lineHeight: 1.5 }}>Memo will weave today's people, memories, and reminders into a gentle briefing.</div>
          </div>
        )}
        {state === "loading" && (
          <div style={{ background: FM_SURF, borderRadius: 16, padding: "20px 18px" }}>
            <ShimmerBar w="70%" /><ShimmerBar w="92%" /><ShimmerBar w="84%" /><ShimmerBar w="60%" />
          </div>
        )}
        {state === "done" && (
          <div style={{ background: FM_SURF, borderRadius: 16, padding: "18px 18px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: FM_LAV, marginBottom: 14 }}>5 cards ready</div>
            {BRIEF_LINES.map((l, i) => (
              <div key={i} className="m-enter" style={{ ...fmRise(motion, i * 90), display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid #ffffff10" : "none" }}>
                <span style={{ width: 26, height: 26, borderRadius: 13, background: FM_SUNK, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: FM_LAV, fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                </span>
                <span style={{ fontSize: 15.5, color: FM_FG }}>{l}</span>
                <Icon name="check" size={16} color="#4caf50" style={{ marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Scroll>
  );
}

Object.assign(window, { FormScreen, FiltersScreen, PreviewScreen });
