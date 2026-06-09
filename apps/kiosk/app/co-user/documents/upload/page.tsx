import { Suspense } from "react";
import DocumentUploadClient from "./DocumentUploadClient";

export default function DocumentUploadPage() {
  return (
    <Suspense>
      <DocumentUploadClient />
    </Suspense>
  );
}
