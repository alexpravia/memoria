import { Suspense } from "react";
import EditPersonClient from "./EditPersonClient";

export default function EditPersonPage() {
  return (
    <Suspense>
      <EditPersonClient />
    </Suspense>
  );
}
