/* memoria-chat.jsx — "Talk to Memo" chat, brought to life.
   window.ChatScreen({ motion, typingDots })
   Auto-plays a short, warm conversation so the motion is visible. */

const C_PURPLE = "#7c4dff", C_LAV = "#b388ff", C_FG = "#e0e0e0", C_SURF = "#2a2a4a";

const SCRIPT = [
  { role: "assistant", text: "Hi, I'm Memo. You can ask me anything about yourself, your family, or your schedule." },
  { role: "user", text: "Who is Eleanor?" },
  { role: "assistant", text: "Eleanor is your daughter. She lives in Portland and visits every Sunday. You taught her to bake bread when she was little.", photo: "person" },
  { role: "user", text: "What's happening today?" },
  { role: "assistant", text: "Today is Saturday — a calm, open day. No appointments. Eleanor is coming by tomorrow afternoon." },
];

const C_PHOTOS = {
  person: "radial-gradient(90% 90% at 50% 38%, #f6c9b0, #c98a86 45%, #6d5891 80%, #2e2a55)",
};

function ChatBubble({ msg, motion, speaking }) {
  const mounted = window.useEntrance();
  const isUser = msg.role === "user";
  const enter = motion.on ? {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translate(0,0)" : `translate(${isUser ? 18 : -18}px, 8px)`,
    transition: "opacity .45s cubic-bezier(.2,.7,.3,1), transform .45s cubic-bezier(.2,.7,.3,1)",
  } : {};
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      <div style={{
        maxWidth: "82%", borderRadius: 18, padding: "13px 17px",
        background: isUser ? C_PURPLE : C_SURF,
        borderBottomRightRadius: isUser ? 4 : 18,
        borderBottomLeftRadius: isUser ? 18 : 4,
        boxShadow: (!isUser && speaking && motion.on) ? "0 0 0 2px rgba(124,77,255,0.55), 0 0 22px rgba(124,77,255,0.4)" : "0 0 0 0 rgba(124,77,255,0)",
        transition: "box-shadow .5s ease",
        ...enter,
      }}>
        <div style={{ fontSize: 18, lineHeight: 1.45, color: isUser ? "#fff" : C_FG }}>{msg.text}</div>
        {msg.photo && (
          <div style={{
            marginTop: 10, width: 180, height: 135, borderRadius: 12, overflow: "hidden", position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 0, background: C_PHOTOS[msg.photo],
              animation: motion.on ? `m-kenburns-a ${18 / Math.max(motion.amp, 0.5)}s ease-in-out infinite alternate` : "none",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots({ motion }) {
  const mounted = window.useEntrance();
  return (
    <div style={{
      display: "flex", justifyContent: "flex-start", marginBottom: 12,
      opacity: motion.on ? (mounted ? 1 : 0) : 1, transition: "opacity .3s ease",
    }}>
      <div style={{
        background: C_SURF, borderRadius: 18, borderBottomLeftRadius: 4,
        padding: "16px 18px", display: "flex", gap: 6, alignItems: "center",
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 9, height: 9, borderRadius: "50%", background: C_LAV,
            animation: motion.on ? `m-typing ${1.1 / Math.max(motion.amp, 0.5)}s ease-in-out ${i * 0.16}s infinite` : "none",
            opacity: motion.on ? undefined : 0.6,
          }} />
        ))}
      </div>
    </div>
  );
}

function ChatScreen({ motion, typingDots }) {
  // step drives how much of the script is visible; "typing" shows dots
  // before each assistant reply.
  const [count, setCount] = React.useState(1);
  const [typing, setTyping] = React.useState(false);
  const [speakingIdx, setSpeakingIdx] = React.useState(0);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    let timers = [];
    function schedule(n, delay) { timers.push(setTimeout(() => {}, 0)); }
    // walk the script
    let t = 900;
    const run = [];
    for (let i = 1; i < SCRIPT.length; i++) {
      const isAssistant = SCRIPT[i].role === "assistant";
      if (isAssistant && typingDots !== false) {
        const showT = t;
        run.push(setTimeout(() => setTyping(true), showT));
        t += 1500;
        run.push(setTimeout(() => { setTyping(false); setCount(i + 1); setSpeakingIdx(i); }, t));
        t += 2600;
      } else {
        const c = i + 1;
        run.push(setTimeout(() => { setCount(c); setSpeakingIdx(c - 1); }, t));
        t += 1400;
      }
    }
    return () => run.forEach(clearTimeout);
  }, [typingDots]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, typing]);

  const visible = SCRIPT.slice(0, count);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div style={{
        paddingTop: 60, paddingBottom: 14, paddingInline: 20,
        borderBottom: "1px solid #2a2a4a", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ color: C_LAV, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="back" size={18} color={C_LAV} /> Back
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ position: "relative", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="memo" size={24} color={C_LAV} />
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: C_FG }}>Talk to Memo</span>
        </span>
        <span style={{ width: 40 }} />
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {visible.map((m, i) => (
          <ChatBubble key={i} msg={m} motion={motion} speaking={motion.on && i === speakingIdx && i === count - 1 && !typing} />
        ))}
        {typing && <TypingDots key={"typing" + count} motion={motion} />}
      </div>

      {/* input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 30px",
        borderTop: "1px solid #2a2a4a",
      }}>
        <div style={{
          flex: 1, background: C_SURF, borderRadius: 24, padding: "13px 20px",
          color: "#666", fontSize: 17,
        }}>Ask a question…</div>
        <PressBtn motion={motion} style={{
          width: 50, height: 50, borderRadius: 25, background: C_PURPLE,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: motion.on ? `m-breathe ${2.8 / Math.max(motion.amp, 0.5)}s ease-in-out infinite` : "none",
        }}>
          <Icon name="forward" size={24} color="#fff" />
        </PressBtn>
      </div>
    </div>
  );
}

window.ChatScreen = ChatScreen;
