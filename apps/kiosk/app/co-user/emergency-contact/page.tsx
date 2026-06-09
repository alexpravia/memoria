import { Suspense } from "react";
import EmergencyContactClient from "./EmergencyContactClient";

export default function EmergencyContactPage() {
  return (
    <Suspense>
      <EmergencyContactClient />
    </Suspense>
  );
}
