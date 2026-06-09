import { Suspense } from "react";
import PhotosClient from "./PhotosClient";

export default function PhotosPage() {
  return (
    <Suspense>
      <PhotosClient />
    </Suspense>
  );
}
