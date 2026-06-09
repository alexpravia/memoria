import { Suspense } from "react";
import ImportPhotosClient from "./ImportPhotosClient";

export default function ImportPhotosPage() {
  return (
    <Suspense>
      <ImportPhotosClient />
    </Suspense>
  );
}
