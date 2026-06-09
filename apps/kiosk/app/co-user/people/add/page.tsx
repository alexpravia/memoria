import { Suspense } from "react";
import AddPersonClient from "./AddPersonClient";

export default function AddPersonPage() {
  return (
    <Suspense>
      <AddPersonClient />
    </Suspense>
  );
}
