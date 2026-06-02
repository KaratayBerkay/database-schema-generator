import { Suspense } from "react";
import { ValidationPageContent } from "@/app/views/validation/validation-page-content";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function ValidationPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <ValidationPageContent />
    </Suspense>
  );
}
