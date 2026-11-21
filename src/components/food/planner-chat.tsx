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
import { DEFAULT_MODEL } from "@/lib/models";

// OpenUI's components, recolored to match HomeManage (see homemanage.css).
// Created once, outside the component, so it isn't rebuilt on every render.
const plannerTheme = {
  intelligentFont: "var(--hm-font), system-ui, sans-serif",
  intelligentCanvas: "#f9f7ed",
  intelligentSurface: "#ffffff",
  intelligentSurfaceStrong: "#f2efe2",
  intelligentInk: "#205441",
  intelligentInkHover: "#1a4535",
  intelligentOnInk: "#ffffff",
  intelligentMuted: "#74736a",
  intelligentFaint: "#a9a79b",
  intelligentBorder: "#ebe7d6",
  intelligentBorderStrong: "#dcd7c2",
  intelligentFocus: "#5d7afd",
  intelligentInfo: "#5d7afd",
  intelligentInfoSoft: "#e9edff",
  intelligentSuccess: "#205441",
  intelligentSuccessSoft: "#e3ede7",
  intelligentRadiusSm: "10px",
  intelligentRadiusMd: "14px",
  intelligentRadiusLg: "20px",
  intelligentRadiusXl: "28px",
};

// Friendly names for the "behind the scenes" chips shown while tools run.
const TOOL_LABELS: Record<string, string> = {
  get_pantry: "Checking the pantry",
  get_week_plan: "Reading the week plan",
  plan_meals: "Saving meals to the plan",
  remove_planned_meal: "Removing a meal",
  get_instagram_recipes: "Reading recipes on Instagram",
  build_shopping_list: "Building the shopping list",
  add_to_shopping_list: "Updating the shopping list",
  get_shopping_list: "Reading the shopping list",
  update_shopping_list: "Updating the shopping list",
  remember_preference: "Saving to memory",
  find_recipes: "Looking through saved recipes",
  save_recipe: "Saving the recipe",
};

const SUGGESTIONS = [
  "Plan our dinners for this week",
  "Something quick for tonight with what we have",
  "Plan a week of healthy lunches to take to work",
];

export function PlannerChat({ weekStart, weekLabel }: { weekStart: string; weekLabel: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  // One conversation id per visit; the server uses it to save the thread.
  const [threadId] = useState(() => crypto.randomUUID());

  // The transport says WHERE and HOW to send messages. `body` adds our extra
  // fields to every request: the route needs `threadId` and `model`, and
  // `weekStart` tells the planner which week is open on screen.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({ api: "/api/chat", body: { threadId, model: DEFAULT_MODEL, weekStart } }),
    [threadId, weekStart],
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
        placeholder={open ? "Reply to the planner…" : "What do you want to eat this week?"}
        aria-label="Message the planner"
        // Tapping the docked bar with an existing conversation reopens it.
        onFocus={() => messages.length > 0 && setOpen(true)}
      />
      {busy ? (
        <button type="button" className="hm-send" onClick={() => stop()} aria-label="Stop">
          <CloseIcon />
        </button>
      ) : (
        <button type="submit" className="hm-send" disabled={!input.trim()} aria-label="Send">
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
          <section className="hm-sheet" role="dialog" aria-label="Meal planner">
            <header className="hm-sheet-header">
              <span className="hm-ai-dot">
                <SparkleIcon />
              </span>
              <div style={{ flex: 1 }}>
                <p className="hm-section-title">Planner</p>
                <p className="hm-muted hm-small">Week of {weekLabel}</p>
              </div>
              <button type="button" className="hm-icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </header>

            <div className="hm-sheet-body">
              {messages.length === 0 && (
                <div>
                  <p className="hm-muted">Tell me what you feel like eating, or start from one of these:</p>
                  <div className="hm-suggestions">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" className="hm-suggestion" onClick={() => send(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ThemeProvider mode="light" lightTheme={plannerTheme}>
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    streaming={busy && index === messages.length - 1}
                    onFollowUp={send}
                  />
                ))}
              </ThemeProvider>

              {status === "submitted" && <span className="hm-tool-chip running">Thinking</span>}
              {error && <p className="hm-error">Something went wrong: {error.message}</p>}
              <div ref={endRef} />
            </div>

            <footer className="hm-sheet-footer">{composer}</footer>
          </section>
        </>
      )}
    </>
  );
}

// OpenUI Lang programs start with `root = …`, sometimes inside a ``` code
// fence. While a reply is still streaming we may only have "ro" or "```op"
// so far, so beginnings of those count too.
function looksLikeOpenUILang(text: string) {
  const start = text.trimStart().replace(/^```[\w-]*\s*/, "");
  if (start.startsWith("root") || "root".startsWith(start)) return true;
  return text.trimStart().startsWith("`") && start === "";
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
                {TOOL_LABELS[toolName] ?? toolName.replaceAll("_", " ")}
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
          const content = parseMessage(part.text, { streaming }).content.trim();
          if (!content) return null;
          if (!looksLikeOpenUILang(content)) {
            return (
              <p key={i} className="hm-muted" style={{ fontSize: 15, margin: "0 0 8px" }}>
                {content}
              </p>
            );
          }
          return (
            <Renderer
              key={i}
              response={part.text}
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
          );
        }
        return null;
      })}
    </div>
  );
}
