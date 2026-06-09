import { Suspense } from "react";
import SetupLoginClient from "./SetupLoginClient";

export default function SetupLoginPage() {
  return (
    <Suspense>
      <SetupLoginClient />
    </Suspense>
  );
}
