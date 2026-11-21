// "use client" tells Next.js this component runs in the BROWSER (it uses
// state, hooks and user interaction). Without it, Next.js would try to render
// it only on the server. Never put secrets (like THESYS_API_KEY) in this file.
"use client";

// =============================================================================
// CLOUD CHAT — THE BROWSER SIDE OF THE CHAT
// =============================================================================
// This is the whole chat screen you see at http://localhost:3000.
// It's built from OpenUI's ready-made <AgentInterface>, which gives you:
// a sidebar with past threads, a message list, an input box, a welcome screen,
// and — most importantly — the RENDERER that turns the AI's OpenUI Lang into
// real components while it streams in.
//
// It's wired up with three main things:
//   llm               -> HOW to talk to our server (/api/chat)
//   storage           -> WHERE threads are saved/loaded (OpenUI Cloud)
//   componentLibrary  -> WHICH components the renderer knows how to draw
// =============================================================================

// Small pieces of this project:
import { OpenUIWordmark } from "@/components/openui-wordmark"; // the "OpenUI" logo text in the sidebar
import { usePersistedModel } from "@/hooks/use-persisted-model"; // remembers your chosen model (in the browser)
import { MODEL_OPTIONS } from "@/lib/models"; // the list of models in the switcher
import { OPENUI_LOGO, STARTERS } from "@/lib/starters"; // logo path + suggested first prompts

// The component library — the SAME one the server describes to the AI
// (see src/lib/library.ts). The renderer uses it to draw what the AI writes.
// ThemeProvider gives those components their colors/fonts for light/dark mode.
import { library, ThemeProvider } from "@openuidev/intelligent-ui-library";

// OpenUI's React chat UI building blocks:
import {
  AgentInterface, // the full chat app (sidebar, thread, input, renderer)
  fetchLLM, // creates the "how to call the backend" object
  ModelSwitcher, // the model dropdown
  useOpenuiCloudStorage, // saves/loads threads from OpenUI Cloud
  useThemeModePreference, // light/dark mode that follows the system or your choice
  vercelAIAdapter, // knows how to READ the Vercel AI SDK stream our route sends
  vercelAIMessageFormat, // knows how to WRITE messages in the shape our route expects
  WelcomeMascot, // the little mascot image on the welcome screen
} from "@openuidev/react-ui";

export default function CloudChat() {
  // Follows the system theme until the footer toggle is first used, then
  // remembers the choice.
  // `mode` = "light" | "dark"; `setPreference` changes it.
  const { setPreference, mode } = useThemeModePreference();

  // Which AI model is selected, saved so it survives reloads.
  // Works like useState: [value, setter].
  const [selectedModel, setSelectedModel] = usePersistedModel();

  // ---------------------------------------------------------------------------
  // llm: how the chat sends messages to our server.
  // ---------------------------------------------------------------------------
  // The route returns the AI SDK's native UIMessage stream, so the browser
  // decodes it with the SDK's own adapter and message format.
  // If you ever change the backend (e.g. to LangGraph), these two must change
  // with it — the browser and server must speak the same stream format.
  const llm = fetchLLM({
    url: "/api/chat", // -> src/app/api/chat/route.ts
    streamAdapter: vercelAIAdapter(),
    messageFormat: vercelAIMessageFormat,
    // Extra fields added to every request body. The route reads `model`
    // and checks it against the allow-list in src/lib/models.tsx.
    body: { model: selectedModel },
  });

  // ---------------------------------------------------------------------------
  // storage: where conversations are kept.
  // ---------------------------------------------------------------------------
  // Threads are stored in OpenUI Cloud (not in our own database). The browser
  // gets a short-lived token from OUR server at /api/frontend-token — so the
  // real API key stays on the server — and uses it to list/load threads.
  // (Later, when HomeManage has its own DB, you could store chats there instead.)
  const storage = useOpenuiCloudStorage({
    token: "/api/frontend-token", // -> src/app/api/frontend-token/route.ts
    apiBaseUrl: "https://api.thesys.dev",
    // "Artifacts" (side-panel outputs) are turned off in this template.
    features: { artifact: false },
  });

  return (
    // Applies the light/dark theme to all the generated components.
    <ThemeProvider mode={mode}>
      <AgentInterface
        storage={storage}
        llm={llm}
        // THE RENDERER'S LIBRARY: must match what the server told the AI about.
        componentLibrary={library}
        logoUrl={OPENUI_LOGO}
        theme={{ mode }}
        starters={STARTERS} // suggestion cards on the welcome screen (src/lib/starters.tsx)
      >
        {/*
          The children below are "slots": named places in AgentInterface
          you can fill or customize. Remove one and you get the default;
          change one to restyle that part of the screen.
        */}

        {/* Top of the sidebar: the app name/logo. We could put "HomeManage" here. */}
        <AgentInterface.SidebarHeader agentName={<OpenUIWordmark mode={mode} />} />

        {/* Bottom of the sidebar: the light/dark toggle. */}
        <AgentInterface.SidebarFooter>
          <AgentInterface.ThemeModeToggle mode={mode} onModeChange={setPreference} />
        </AgentInterface.SidebarFooter>

        {/* Header on small (phone) screens, with the model switcher in it. */}
        <AgentInterface.MobileHeader
          agentName=""
          logo={
            <ModelSwitcher
              models={MODEL_OPTIONS}
              value={selectedModel}
              onValueChange={setSelectedModel}
            />
          }
        />

        {/* Header above the conversation on desktop, with the model switcher. */}
        <AgentInterface.ThreadHeader
          showChatTitle={false}
          start={
            <ModelSwitcher
              models={MODEL_OPTIONS}
              value={selectedModel}
              onValueChange={setSelectedModel}
            />
          }
        />

        {/* The empty-state screen before you send the first message. */}
        <AgentInterface.Welcome
          image={<WelcomeMascot />}
          title="What's on your mind today?" // e.g. "What are we cooking today?"
          starterVariant="card" // show starters as cards (not plain chips)
          glowAnimation
        />
      </AgentInterface>
    </ThemeProvider>
  );
}
