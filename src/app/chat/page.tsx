// The original full-screen OpenUI chat from the template, kept at /chat as a
// reference and a general-purpose assistant. The app itself starts at /food.
import "@openuidev/react-ui/styles/index.css";

import CloudChat from "@/components/cloud-chat";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div style={{ height: "100dvh" }}>
      <CloudChat />
    </div>
  );
}
