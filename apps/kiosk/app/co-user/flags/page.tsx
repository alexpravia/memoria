import { Suspense } from "react";
import FlagsClient from "./FlagsClient";

export default function FlagsPage() {
  return (
    <Suspense>
      <FlagsClient />
    </Suspense>
  );
}
