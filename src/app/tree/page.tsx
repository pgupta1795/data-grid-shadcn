import * as React from "react";
import { Client } from "./client";
import { Skeleton } from "./skeleton";

export default async function Page() {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <Client />
    </React.Suspense>
  );
}
