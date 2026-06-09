import { Suspense } from "react";
import AddEventClient from "./AddEventClient";

export default function AddEventPage() {
  return (
    <Suspense>
      <AddEventClient />
    </Suspense>
  );
}
