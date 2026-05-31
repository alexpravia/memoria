"use client";

// Side-effect: initializes the @memoria/core supabase client for the kiosk.
import "@/lib/supabase";

import React, { useCallback, useRef, useState } from "react";
import { askAssistant, useAuth } from "@memoria/core";
import * as tts from "@/lib/tts-web";
import { Logo } from "@/components/Logo";
import Icon from "@/components/Icon";

interface Message {
  role: "user" | "memo";
  text: string;
  photos?: string[];
}

export default function AssistantClient() {
  const { userId, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;

    const uid = userId ?? session?.user.id;
    if (!uid) {
      setMessages((m) => [
        ...m,
        {
          role: "memo",
          text: "Please sign in to talk to Memo.",
        },
      ]);
      return;
    }

    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setThinking(true);

    const resp = await askAssistant(uid, text, conversationIdRef.current);
    conversationIdRef.current = resp.conversationId;
    setThinking(false);

    if (resp.error && !resp.answer) {
      setMessages((m) => [
        ...m,
        { role: "memo", text: "I had trouble with that. Please try again." },
      ]);
      return;
    }

    const answer = resp.answer;
    setMessages((m) => [
      ...m,
      { role: "memo", text: answer, photos: resp.photos },
    ]);

    setSpeaking(true);
    await tts.speak(answer, {
      onDone: () => setSpeaking(false),
    });
  }, [input, thinking, userId, session]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    tts.stop();
    setSpeaking(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        color: "var(--color-fg)",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 24px",
          borderBottom: "1px solid var(--color-surface-raised)",
        }}
      >
        <Logo size={32} />
        <span
          style={{
            fontSize: "var(--type-h2)",
            fontWeight: "var(--type-weight-medium)",
            color: "var(--color-fg-strong)",
          }}
        >
          Talk to Memo
        </span>
        {speaking && (
          <button
            onClick={handleStop}
            style={{
              marginLeft: "auto",
              background: "var(--color-surface)",
              border: "none",
              borderRadius: "var(--radius-full)",
              padding: "8px 16px",
              color: "var(--color-primary-soft)",
              fontSize: "var(--type-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="block" size={16} />
            Stop
          </button>
        )}
      </header>

      {/* Messages */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--color-fg-muted)",
              marginTop: 80,
              fontSize: "var(--type-lg)",
            }}
          >
            <Icon name="memo" size={40} />
            <p style={{ marginTop: 16 }}>Ask Memo anything about your life.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              gap: 8,
            }}
          >
            <div
              style={{
                maxWidth: "72%",
                background:
                  msg.role === "user"
                    ? "var(--color-primary)"
                    : "var(--color-surface)",
                color:
                  msg.role === "user"
                    ? "var(--color-fg-strong)"
                    : "var(--color-fg)",
                borderRadius:
                  msg.role === "user"
                    ? "var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)"
                    : "var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)",
                padding: "12px 16px",
                fontSize: "var(--type-lg)",
                lineHeight: 1.5,
              }}
            >
              {msg.text}
            </div>

            {msg.photos && msg.photos.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {msg.photos.map((url, j) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={j}
                    src={url}
                    alt="Memory photo"
                    style={{
                      width: 200,
                      height: 150,
                      objectFit: "cover",
                      borderRadius: "var(--radius-lg)",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div
            style={{
              alignSelf: "flex-start",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-xl)",
              padding: "12px 16px",
              color: "var(--color-fg-muted)",
              fontSize: "var(--type-base)",
            }}
          >
            Memo is thinking…
          </div>
        )}
      </main>

      {/* Input */}
      <footer
        style={{
          padding: 16,
          borderTop: "1px solid var(--color-surface-raised)",
          display: "flex",
          gap: 12,
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message to Memo…"
          disabled={thinking}
          style={{
            flex: 1,
            background: "var(--color-surface)",
            border: "2px solid var(--color-surface-raised)",
            borderRadius: "var(--radius-pill)",
            padding: "12px 20px",
            color: "var(--color-fg)",
            fontSize: "var(--type-md)",
            outline: "none",
            opacity: thinking ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          style={{
            background: "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-full)",
            width: 52,
            height: 52,
            cursor: input.trim() && !thinking ? "pointer" : "not-allowed",
            opacity: !input.trim() || thinking ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="forward" size={22} color="white" />
        </button>
      </footer>
    </div>
  );
}
