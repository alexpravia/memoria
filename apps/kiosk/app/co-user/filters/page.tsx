import { Suspense } from "react";
import FiltersClient from "./FiltersClient";

export default function FiltersPage() {
  return (
    <Suspense>
      <FiltersClient />
    </Suspense>
  );
}
