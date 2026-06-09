import { Suspense } from "react";
import LifeFactsClient from "./LifeFactsClient";

export default function LifeFactsPage() {
  return (
    <Suspense>
      <LifeFactsClient />
    </Suspense>
  );
}
