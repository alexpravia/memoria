import { Suspense } from "react";
import AddLifeFactClient from "./AddLifeFactClient";

export default function AddLifeFactPage() {
  return (
    <Suspense>
      <AddLifeFactClient />
    </Suspense>
  );
}
