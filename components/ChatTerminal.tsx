"use client";

import { useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/**
 * Minimal chat client that talks to the OpenAI-compatible endpoint and renders
 * the streamed response. No history is persisted.
 */
export function ChatTerminal() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "xynq", messages: next, stream: true }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const json = JSON.parse(payload);
            acc += json.choices?.[0]?.delta?.content ?? "";
            setMessages([...next, { role: "assistant", content: acc }]);
          } catch {
            /* ignore keepalive lines */
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #1c3a2b", borderRadius: 8, padding: 16 }}>
      <div style={{ minHeight: 160, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <p key={i} style={{ color: m.role === "user" ? "#9ab5a8" : "#e6ffe6" }}>
            <span style={{ color: "#5b7468" }}>{m.role === "user" ? "you" : "xynq"} ▸ </span>
            {m.content}
          </p>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="ask anything"
          style={{
            flex: 1,
            background: "#0a0a0a",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "10px 12px",
          }}
        />
        <button onClick={send} disabled={busy} style={{ padding: "10px 16px" }}>
          {busy ? "…" : "send"}
        </button>
      </div>
    </div>
  );
}
