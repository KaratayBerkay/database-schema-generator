import { readProjects } from "@/lib/stores/projects-store";
import { redirect } from "next/navigation";
import CreateFirstProject from "@/components/projects/create-first-project";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await readProjects();

  if (projects.length > 0) {
    redirect("/tables");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <CreateFirstProject />
    </div>
  );
}
