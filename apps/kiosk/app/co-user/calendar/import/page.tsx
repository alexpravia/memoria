import { Suspense } from "react";
import CalendarImportClient from "./CalendarImportClient";

export default function CalendarImportPage() {
  return (
    <Suspense>
      <CalendarImportClient />
    </Suspense>
  );
}
