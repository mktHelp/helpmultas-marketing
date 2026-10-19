import { Suspense } from "react";
import { ContentHub } from "@/components/planning/ContentHub";

export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentHub />
    </Suspense>
  );
}
