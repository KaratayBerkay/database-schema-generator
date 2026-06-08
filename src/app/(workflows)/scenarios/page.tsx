import { Suspense } from "react";
import { ScenariosPageContent } from "@/app/views/scenarios/scenarios-page";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function ScenariosPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <ScenariosPageContent />
    </Suspense>
  );
}
