/* memoria-couser.jsx — co-user (caregiver) screens, brought to life.
   People · Photos · Events · Review Queue.
   Exports window.PeopleScreen, PhotosScreen, EventsScreen, ReviewScreen,
   plus shared window.CoLoader / window.CoEmpty / window.CoHeader. */

const CU_BG = "#1a1a2e", CU_SURF = "#2a2a4a", CU_SUNK = "#22223a", CU_RAISE = "#3a3a5a";
const CU_PURPLE = "#7c4dff", CU_LAV = "#b388ff", CU_FG = "#e0e0e0", CU_MUTE = "#9a9ab0";

function rise(motion, delay) {
  return motion.on ? { animation: `m-rise .55s cubic-bezier(.2,.7,.3,1) ${delay}ms both` } : {};
}

function CoHeader({ title, sub, motion }) {
  return (
    <div className="m-enter" style={rise(motion, 0)}>
      <div style={{ fontSize: 32, fontWeight: 700, color: CU_FG }}>{title}</div>
      <div style={{ fontSize: 15, color: CU_MUTE, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function CoLoader({ label, motion }) {
  const amp = Math.max(motion.amp, 0.5);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ position: "relative", width: 86, height: 86, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {[0, 1].map((j) => (
          <span key={j} style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `2px solid ${CU_PURPLE}`, animation: motion.on ? `m-pulse-ring ${2.4 / amp}s ease-out ${j * 1.2}s infinite` : "none" }} />
        ))}
        <div style={{ animation: motion.on ? `m-breathe ${2.6 / amp}s ease-in-out infinite` : "none" }}>
          <FlowerGlyph size={52} glow />
        </div>
      </div>
      <div style={{ color: CU_LAV, fontSize: 16, animation: motion.on ? `m-glow ${2.6 / amp}s ease-in-out infinite` : "none" }}>{label}</div>
    </div>
  );
}

function CoEmpty({ title, sub, motion, flower }) {
  const amp = Math.max(motion.amp, 0.5);
  const len = 26;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 92, height: 92, borderRadius: 46, background: flower ? "rgba(124,77,255,0.12)" : "rgba(76,175,80,0.12)", display: "flex", alignItems: "center", justifyContent: "center", animation: motion.on ? `m-float ${5 / amp}s ease-in-out infinite` : "none" }}>
        {flower ? <FlowerGlyph size={48} glow /> : (
          <svg width="50" height="50" viewBox="0 0 24 24">
            <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#4caf50" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={len} strokeDashoffset={motion.on ? len : 0}
              style={{ animation: motion.on ? "m-draw .7s cubic-bezier(.5,0,.2,1) .3s forwards" : "none" }} />
          </svg>
        )}
      </div>
      <div style={{ color: CU_FG, fontSize: 20, fontWeight: 600 }}>{title}</div>
      <div style={{ color: CU_MUTE, fontSize: 15, textAlign: "center", maxWidth: 240, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}

function StateSeg({ state, setState, options, motion }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 18 }}>
      {options.map(([val, lbl]) => (
        <PressBtn key={val} motion={motion} onClick={() => setState(val)}
          style={{ flex: 1, background: state === val ? CU_PURPLE : CU_SUNK, borderRadius: 9, padding: "7px 0" }}>
          <span style={{ color: state === val ? "#fff" : CU_MUTE, fontWeight: 600, fontSize: 12.5 }}>{lbl}</span>
        </PressBtn>
      ))}
    </div>
  );
}

function Avatar({ initial, colors, size = 46 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
      <span style={{ color: "#fff", fontSize: size * 0.4, fontWeight: 700 }}>{initial}</span>
    </div>
  );
}

const PrimaryRow = ({ icon, label, motion, delay }) => (
  <div className="m-enter" style={rise(motion, delay)}>
    <PressBtn motion={motion} style={{ width: "100%", background: CU_PURPLE, borderRadius: 16, padding: "15px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: motion.on ? "0 10px 26px rgba(124,77,255,0.32)" : "none" }}>
      <Icon name={icon} size={22} color="#fff" accentColor="#fff" />
      <span style={{ color: "#fff", fontSize: 17, fontWeight: 600 }}>{label}</span>
    </PressBtn>
  </div>
);

const Scroll = ({ children }) => (
  <div style={{ position: "absolute", inset: 0, background: CU_BG, overflow: "auto" }}>
    <div style={{ padding: "62px 20px 30px", minHeight: "100%", position: "relative" }}>{children}</div>
  </div>
);

/* ---------------- People ---------------- */
const PEOPLE = [
  { n: "Eleanor", r: "Daughter · visits Sundays", c: ["#7c4dff", "#b388ff"] },
  { n: "Robert", r: "Son · calls every week", c: ["#5e92d8", "#8fc0e8"] },
  { n: "Tom", r: "Grandson · away at college", c: ["#4caf50", "#8fd49a"] },
  { n: "Grace", r: "Neighbor & dear friend", c: ["#e0a06a", "#f0c89a"] },
  { n: "Dr. Lewis", r: "Primary doctor", c: ["#9c6bff", "#c9a8ff"] },
];

function PeopleScreen({ motion }) {
  const [state, setState] = React.useState("loaded");
  return (
    <Scroll>
      <CoHeader title="People" sub="Who's in Margaret's circle" motion={motion} />
      <StateSeg state={state} setState={setState} motion={motion} options={[["loaded", "Loaded"], ["loading", "Loading"], ["empty", "Empty"]]} />
      {state === "loading" && <div style={{ position: "relative", height: 340 }}><CoLoader label="Loading people…" motion={motion} /></div>}
      {state === "empty" && <div style={{ position: "relative", height: 340 }}><CoEmpty flower title="No people yet" sub="Add the people who matter most to Margaret." motion={motion} /></div>}
      {state === "loaded" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PrimaryRow icon="addPerson" label="Add a person" motion={motion} delay={110} />
          {PEOPLE.map((p, i) => (
            <div key={p.n} className="m-enter" style={rise(motion, 180 + i * 75)}>
              <PressBtn motion={motion} style={{ width: "100%", textAlign: "left", background: CU_SURF, borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar initial={p.n[0]} colors={p.c} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: CU_FG }}>{p.n}</div>
                  <div style={{ fontSize: 13.5, color: CU_MUTE, marginTop: 2 }}>{p.r}</div>
                </div>
                <Icon name="forward" size={20} color="#6a6a85" />
              </PressBtn>
            </div>
          ))}
        </div>
      )}
    </Scroll>
  );
}

/* ---------------- Photos ---------------- */
const PHOTO_TILES = [
  { g: "radial-gradient(120% 100% at 30% 25%, #ffd9a8, #b9657a 75%, #5e3a6e)", s: "verified" },
  { g: "radial-gradient(90% 90% at 50% 38%, #f6c9b0, #6d5891 80%, #2e2a55)", s: "pending" },
  { g: "radial-gradient(120% 100% at 65% 30%, #ffe6b8, #9a6a8c 75%, #3d3a6a)", s: "verified" },
  { g: "radial-gradient(110% 100% at 40% 30%, #cfe8b0, #5e8f9c 75%, #344a6e)", s: "verified" },
  { g: "radial-gradient(120% 100% at 50% 30%, #ffc9c0, #7c5aa8 78%, #2e2a55)", s: "hidden" },
  { g: "radial-gradient(100% 100% at 40% 30%, #b0d8e8, #4a6e9c 78%, #2a2e55)", s: "pending" },
];
const PSTATUS = { verified: { i: "check", c: "#1b5e20" }, pending: { i: "pending", c: "#ffab40" }, hidden: { i: "block", c: "#b71c1c" } };

function PhotosScreen({ motion }) {
  const [filter, setFilter] = React.useState("all");
  const pills = [["all", "All", null], ["pending", "Pending", "pending"], ["verified", "Verified", "check"]];
  const shown = PHOTO_TILES.filter((t) => filter === "all" || t.s === filter);
  return (
    <Scroll>
      <CoHeader title="Photos" sub="128 photos · 3 pending review" motion={motion} />
      <div className="m-enter" style={{ ...rise(motion, 110), display: "flex", gap: 8, marginTop: 16, marginBottom: 16 }}>
        {pills.map(([val, lbl, ic]) => (
          <PressBtn key={val} motion={motion} onClick={() => setFilter(val)}
            style={{ flex: 1, background: filter === val ? CU_PURPLE : CU_SUNK, borderRadius: 9, padding: "8px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }}>
            {ic && <Icon name={ic} size={13} color={filter === val ? "#fff" : CU_MUTE} />}
            <span style={{ color: filter === val ? "#fff" : CU_MUTE, fontWeight: 600, fontSize: 12.5 }}>{lbl}</span>
          </PressBtn>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {shown.map((t, i) => {
          const st = PSTATUS[t.s];
          return (
            <div key={i} className="m-enter" style={rise(motion, 180 + i * 70)}>
              <PressBtn motion={motion} style={{ width: "100%", padding: 0, borderRadius: 14, overflow: "hidden", display: "block", position: "relative", aspectRatio: "1 / 1", background: t.g }}>
                <span style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, background: st.c, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.35)" }}>
                  <Icon name={st.i} size={15} color="#fff" />
                </span>
              </PressBtn>
            </div>
          );
        })}
      </div>
    </Scroll>
  );
}

/* ---------------- Events ---------------- */
const EVENTS = [
  { d: "TUE", t: "Dr. Lewis — checkup", time: "2:00 PM", soon: true },
  { d: "THU", t: "Eleanor visits", time: "All day" },
  { d: "SAT", t: "Garden club", time: "10:00 AM" },
  { d: "SUN", t: "Family video call", time: "4:00 PM" },
];

function EventsScreen({ motion }) {
  return (
    <Scroll>
      <CoHeader title="Events" sub="What's coming up for Margaret" motion={motion} />
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 0 }}>
        <PrimaryRow icon="add" label="Add an event" motion={motion} delay={110} />
        <div style={{ height: 14 }} />
        {EVENTS.map((e, i) => (
          <div key={i} className="m-enter" style={{ ...rise(motion, 190 + i * 80), display: "flex", gap: 14, alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 46 }}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: e.soon ? CU_PURPLE : CU_SUNK, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: e.soon && motion.on ? "0 0 18px rgba(124,77,255,0.5)" : "none" }}>
                <span style={{ color: e.soon ? "#fff" : CU_LAV, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>{e.d}</span>
              </div>
              {i < EVENTS.length - 1 && <div style={{ width: 2, flex: 1, background: "#33304e", marginTop: 2, marginBottom: 2 }} />}
            </div>
            <div style={{ flex: 1, background: CU_SURF, borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: CU_FG }}>{e.t}</div>
              <div style={{ fontSize: 13.5, color: CU_MUTE, marginTop: 3 }}>{e.time}</div>
            </div>
          </div>
        ))}
      </div>
    </Scroll>
  );
}

/* ---------------- Review Queue ---------------- */
const FLAGS = [
  { k: "New memory", t: "“Margaret mentioned she loved sailing as a young woman.”" },
  { k: "Photo caption", t: "“Beach trip, 1985 — with Robert and Eleanor.”" },
  { k: "Preference", t: "“Prefers to be called Maggie by close family.”" },
];

function ReviewScreen({ motion }) {
  const [rows, setRows] = React.useState(FLAGS);
  const [exitId, setExitId] = React.useState(null);
  const act = (idx) => {
    setExitId(idx);
    setTimeout(() => { setRows((r) => r.filter((_, k) => k !== idx)); setExitId(null); }, 460);
  };
  const reset = () => setRows(FLAGS);
  return (
    <Scroll>
      <CoHeader title="Review Queue" sub={`${rows.length} item${rows.length === 1 ? "" : "s"} Memo learned to review`} motion={motion} />
      {rows.length === 0 ? (
        <>
          <div style={{ position: "relative", height: 300, marginTop: 10 }}><CoEmpty title="All caught up" sub="Nothing to review right now." motion={motion} /></div>
          <PressBtn motion={motion} onClick={reset} style={{ margin: "0 auto", display: "block", background: CU_SUNK, borderRadius: 10, padding: "10px 18px" }}>
            <span style={{ color: CU_LAV, fontWeight: 600, fontSize: 14 }}>Replay demo</span>
          </PressBtn>
        </>
      ) : (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((f, idx) => (
            <div key={f.t} className="m-enter" style={exitId === idx ? { animation: "m-leave .46s cubic-bezier(.4,0,1,.6) both" } : rise(motion, 140 + idx * 80)}>
              <div style={{ background: CU_SURF, borderRadius: 16, padding: "16px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: CU_LAV, marginBottom: 8 }}>{f.k}</div>
                <div style={{ fontSize: 16, color: CU_FG, lineHeight: 1.45, marginBottom: 14 }}>{f.t}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <PressBtn motion={motion} onClick={() => act(idx)} style={{ flex: 1, background: "#1b5e20", borderRadius: 8, padding: "9px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }}>
                    <Icon name="check" size={15} color="#fff" /><span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Approve</span>
                  </PressBtn>
                  <PressBtn motion={motion} onClick={() => act(idx)} style={{ flex: 1, background: "#b71c1c", borderRadius: 8, padding: "9px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }}>
                    <Icon name="close" size={15} color="#fff" /><span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Reject</span>
                  </PressBtn>
                  <PressBtn motion={motion} onClick={() => act(idx)} style={{ flex: 1, background: "#37474f", borderRadius: 8, padding: "9px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: 5 }}>
                    <Icon name="hide" size={15} color="#fff" /><span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Hide</span>
                  </PressBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Scroll>
  );
}

Object.assign(window, { PeopleScreen, PhotosScreen, EventsScreen, ReviewScreen, CoLoader, CoEmpty, CoHeader });
window.cuRise = rise;
window.Scroll = Scroll;
window.PrimaryRow = PrimaryRow;
