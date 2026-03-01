import { ADAPTER_COOKIE_NAME } from "@/lib/constants/cookies";
import type { AdapterType } from "@/lib/store";
import { cookies } from "next/headers";
import * as React from "react";
import { Client } from "./client";
import { Skeleton } from "./skeleton";

export default async function Page() {
  const cookieStore = await cookies();
  const adapterType =
    (cookieStore.get(ADAPTER_COOKIE_NAME)?.value as AdapterType) || "nuqs";

  return (
    <React.Suspense fallback={<Skeleton />}>
      <Client defaultAdapterType={adapterType} />
    </React.Suspense>
  );
}
