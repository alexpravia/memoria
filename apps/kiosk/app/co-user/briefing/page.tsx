import { Suspense } from "react";
import BriefingClient from "./BriefingClient";

export default function BriefingPage() {
  return (
    <Suspense>
      <BriefingClient />
    </Suspense>
  );
}
