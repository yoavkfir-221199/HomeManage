import { redirect } from "next/navigation";

// The app opens on the Food section's Plan page.
// (The original full-screen OpenUI chat still lives at /chat.)
export default function Home() {
  redirect("/food/plan");
}
