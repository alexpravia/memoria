import { Suspense } from "react";
import StoryClient from "./StoryClient";

export default function StoryPage() {
  return (
    <Suspense>
      <StoryClient />
    </Suspense>
  );
}
