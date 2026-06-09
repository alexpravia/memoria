import { Suspense } from "react";
import MemoryClient from "./MemoryClient";

export default function MemoryPage() {
  return (
    <Suspense>
      <MemoryClient />
    </Suspense>
  );
}
