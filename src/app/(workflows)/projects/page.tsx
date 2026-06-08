import { Suspense } from "react";
import { ProjectsPageContent } from "@/app/views/projects/projects-page";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <ProjectsPageContent />
    </Suspense>
  );
}
