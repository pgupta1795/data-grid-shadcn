import { PREFETCH_COOKIE_NAME } from "@/lib/constants/cookies";
import { getQueryClient } from "@/providers/get-query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { cookies } from "next/headers";
import type { SearchParams } from "nuqs";
import { Suspense } from "react";
import { Client } from "./client";
import { dataOptions } from "./query-options";
import { searchParamsCache, SearchParamsType } from "./search-params";
import { Skeleton } from "./skeleton";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = await searchParamsCache.parse(searchParams);
  const cookieStore = await cookies();
  const prefetchEnabled =
    cookieStore.get(PREFETCH_COOKIE_NAME)?.value === "true";

  if (prefetchEnabled) {
    return (
      <Suspense fallback={<Skeleton />}>
        <PrefetchedContent
          search={search}
          defaultPrefetchEnabled={prefetchEnabled}
        />
      </Suspense>
    );
  }

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <Client defaultPrefetchEnabled={prefetchEnabled} />
    </HydrationBoundary>
  );
}

async function PrefetchedContent({
  search,
  defaultPrefetchEnabled,
}: {
  search: SearchParamsType;
  defaultPrefetchEnabled: boolean;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(dataOptions(search));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Client defaultPrefetchEnabled={defaultPrefetchEnabled} />
    </HydrationBoundary>
  );
}
