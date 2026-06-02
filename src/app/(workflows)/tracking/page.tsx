import { Suspense } from "react";
import { TrackingPageContent } from "@/app/views/tracking/tracking-page";
import { WorkflowSkeleton } from "@/app/views/shared/workflow-skeleton";

export default function TrackingPage() {
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <TrackingPageContent />
    </Suspense>
  );
}
