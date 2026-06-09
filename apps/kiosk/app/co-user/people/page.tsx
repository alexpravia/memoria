import { Suspense } from "react";
import PeopleClient from "./PeopleClient";

export default function PeoplePage() {
  return (
    <Suspense>
      <PeopleClient />
    </Suspense>
  );
}
