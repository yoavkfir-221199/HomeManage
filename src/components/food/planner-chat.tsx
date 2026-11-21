"use client";

// =============================================================================
// PLANNER CHAT — the AI planner on the Plan page
// =============================================================================
// A slim chat we build ourselves instead of OpenUI's full-screen
// <AgentInterface>, so it fits a mobile page:
//   - a composer docked above the bottom bar ("What do you want to eat…")
//   - sending opens a bottom SHEET with the conversation
//
// Two libraries work together here:
//   - `useChat` (Vercel AI SDK) handles the conversation: sending messages to
//     /api/chat, receiving the stream, keeping the message list.
//   - `<Renderer>` (OpenUI) draws each AI reply: the model answers in OpenUI
//     Lang, and the renderer turns it into cards, lists and buttons, using the
//     SAME component library the server described to the model.
//
// When the AI finishes a reply, we refresh the page so the week plan and the
// shopping list show what the AI just saved.
// =============================================================================

import "@openuidev/react-ui/styles/index.css";

import { useChat } from "@ai-sdk/react";
import { library, ThemeProvider } from "@openuidev/intelligent-ui-library";
import { parseMessage, Renderer } from "@openuidev/react-lang";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import { refreshFood } from "@/app/food/actions";
import { CloseIcon, SendIcon, SparkleIcon } from "@/components/icons";
import { useSettings } from "@/components/settings-provider";
import { DEFAULT_MODEL } from "@/lib/models";

// OpenUI's components, recolored to match HomeManage. The values are CSS
// variables from homemanage.css, so the same theme works in light AND dark
// mode: the variables change, this object doesn't.
// Created once, outside the component, so it isn't rebuilt on every render.
const plannerTheme = {
  intelligentFont: "var(--hm-font), system-ui, sans-serif",
  intelligentCanvas: "var(--hm-bg)",
  intelligentSurface: "var(--hm-surface)",
  intelligentSurfaceStrong: "var(--hm-surface-muted)",
  intelligentInk: "var(--hm-ink)",
  intelligentInkHover: "var(--hm-ink)",
  intelligentOnInk: "var(--hm-on-ink)",
  intelligentMuted: "var(--hm-muted)",
  intelligentFaint: "var(--hm-faint)",
  intelligentBorder: "var(--hm-border)",
  intelligentBorderStrong: "var(--hm-border)",
  intelligentFocus: "var(--hm-accent)",
  intelligentInfo: "var(--hm-accent)",
  intelligentInfoSoft: "var(--hm-accent-soft)",
  intelligentSuccess: "var(--hm-ink)",
  intelligentSuccessSoft: "var(--hm-ink-soft)",
  intelligentRadiusSm: "10px",
  intelligentRadiusMd: "14px",
  intelligentRadiusLg: "20px",
  intelligentRadiusXl: "28px",
};

export function PlannerChat({ weekStart, weekLabel }: { weekStart: string; weekLabel: string }) {
  const { t, lang, mode } = useSettings();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  // One conversation id per visit; the server uses it to save the thread.
  const [threadId] = useState(() => crypto.randomUUID());

  // The transport says WHERE and HOW to send messages. `body` adds our extra
  // fields to every request: the route needs `threadId` and `model`,
  // `weekStart` tells the planner which week is open on screen, and `lang`
  // which language to answer in.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({ api: "/api/chat", body: { threadId, model: DEFAULT_MODEL, weekStart, lang } }),
    [threadId, weekStart, lang],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
    // After every finished reply, refresh the Food pages so changes the AI
    // made (meals, shopping list) appear behind the sheet.
    onFinish: () => {
      void refreshFood();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setOpen(true);
    setInput("");
    void sendMessage({ text: trimmed });
  }

  // Keep the newest message in view while the reply streams in.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, open]);

  const composer = (
    <form
      className="hm-composer"
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={open ? t.planner.replyPlaceholder : t.planner.placeholder}
        aria-label={t.planner.messageLabel}
        // Tapping the docked bar with an existing conversation reopens it.
        onFocus={() => messages.length > 0 && setOpen(true)}
      />
      {busy ? (
        <button type="button" className="hm-send" onClick={() => stop()} aria-label={t.planner.stop}>
          <CloseIcon />
        </button>
      ) : (
        <button type="submit" className="hm-send" disabled={!input.trim()} aria-label={t.planner.send}>
          <SendIcon />
        </button>
      )}
    </form>
  );

  return (
    <>
      {/* The composer docked above the bottom navigation */}
      {!open && (
        <div className="hm-dock">
          <div className="hm-dock-inner">{composer}</div>
        </div>
      )}

      {open && (
        <>
          <div className="hm-sheet-backdrop" onClick={() => setOpen(false)} />
          <section className="hm-sheet" role="dialog" aria-label={t.planner.dialogLabel}>
            <header className="hm-sheet-header">
              <span className="hm-ai-dot">
                <SparkleIcon />
              </span>
              <div style={{ flex: 1 }}>
                <p className="hm-section-title">{t.planner.title}</p>
                <p className="hm-muted hm-small">{t.planner.weekOf(weekLabel)}</p>
              </div>
              <button type="button" className="hm-icon-btn" onClick={() => setOpen(false)} aria-label={t.planner.close}>
                <CloseIcon />
              </button>
            </header>

            <div className="hm-sheet-body">
              {messages.length === 0 && (
                <div>
                  <p className="hm-muted">{t.planner.intro}</p>
                  <div className="hm-suggestions">
                    {t.planner.suggestions.map((s) => (
                      <button key={s} type="button" className="hm-suggestion" onClick={() => send(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ThemeProvider mode={mode} lightTheme={plannerTheme}>
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    streaming={busy && index === messages.length - 1}
                    onFollowUp={send}
                  />
                ))}
              </ThemeProvider>

              {status === "submitted" && <span className="hm-tool-chip running">{t.planner.thinking}</span>}
              {error && <p className="hm-error">{t.planner.error(error.message)}</p>}
              <div ref={endRef} />
            </div>

            <footer className="hm-sheet-footer">{composer}</footer>
          </section>
        </>
      )}
    </>
  );
}

// Split a reply into plain text and OpenUI Lang code.
//
// Normally the model answers with ONLY a program that starts with `root = …`.
// But sometimes it writes a sentence first, and wraps the program in a ```
// code fence, e.g.:  "Here's a recipe: ```openui-lang root = Col([…]) ```"
// Sending all of that to the Renderer fails, and showing it all as text shows
// raw code, so we cut it at the point where the program starts.
const CODE_START = /```[\w-]*\s*(?=root\s*=)|(?:^|\n)\s*(?=root\s*=)/;

function splitReply(content: string): { text: string; code: string } {
  const match = CODE_START.exec(content);
  if (match) {
    const text = content.slice(0, match.index).trim();
    const code = content
      .slice(match.index + match[0].length)
      .replace(/```\s*$/, "") // closing fence
      .trim();
    return { text, code };
  }
  // Still streaming and we only have the very beginning ("ro", "```open"):
  // show nothing yet rather than flashing those characters as text.
  const start = content.trimStart();
  if ("root".startsWith(start) || /^```[\w-]*\s*r?o?o?t?$/.test(start)) return { text: "", code: "" };
  // Plain text only. Drop a half-arrived fence at the end ("…: ``").
  return { text: content.replace(/`{1,3}[\w-]*\s*$/, "").trim(), code: "" };
}

// One message. User messages are plain bubbles; AI messages are made of
// "parts": tool calls (shown as small chips) and text (OpenUI Lang, drawn by
// the Renderer).
function ChatMessage({
  message,
  streaming,
  onFollowUp,
}: {
  message: UIMessage;
  streaming: boolean;
  onFollowUp: (text: string) => void;
}) {
  const { t } = useSettings();
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return <div className="hm-msg-user">{text}</div>;
  }

  return (
    <div className="hm-msg-ai">
      {message.parts.map((part, i) => {
        // Tool parts are typed "tool-<name>", e.g. "tool-get_pantry".
        if (part.type.startsWith("tool-")) {
          const toolName = part.type.slice("tool-".length);
          const done = "state" in part && (part.state === "output-available" || part.state === "output-error");
          return (
            <p key={i} style={{ margin: "0 0 8px" }}>
              <span className={`hm-tool-chip${done ? "" : " running"}`}>
                {t.planner.tools[toolName] ?? toolName.replaceAll("_", " ")}
                {done && " ✓"}
              </span>
            </p>
          );
        }
        if (part.type === "text" && part.text.trim()) {
          // Before calling tools the model sometimes writes a short plain
          // sentence ("Let me check your pantry…"). That isn't OpenUI Lang, so
          // show it as a normal paragraph instead of sending it to the Renderer.
          // Gateway wraps replies in marker lines (]]>openui:content … ]]>openui:end);
          // parseMessage strips them so we can look at the actual content.
          const { text, code } = splitReply(parseMessage(part.text, { streaming }).content);
          if (!text && !code) return null;
          return (
            <div key={i}>
              {text && (
                <p className="hm-muted" style={{ fontSize: 15, margin: "0 0 8px" }}>
                  {text}
                </p>
              )}
              {code && (
                <Renderer
                  response={code}
                  library={library}
                  isStreaming={streaming}
                  // Buttons in the AI's UI (e.g. "Yes, save it") continue the chat.
                  onAction={(event) => {
                    if (event.type === "continue_conversation" && event.humanFriendlyMessage) {
                      onFollowUp(event.humanFriendlyMessage);
                    } else if (event.type === "open_url" && typeof event.params.url === "string") {
                      window.open(event.params.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                />
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
