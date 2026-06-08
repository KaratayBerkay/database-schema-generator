import { redirect } from "next/navigation";

// The app always lands on the dashboard. With no projects yet, the Tables
// workflow shows its empty state and the sidebar links to Projects / Scenarios
// to create or load one — there is no separate "Get started" screen.
export default function HomePage() {
  redirect("/tables");
}
