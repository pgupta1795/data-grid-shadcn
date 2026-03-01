"use client";

import { useHotKey } from "@/hooks/use-hot-key";
import { getLevelRowClassName } from "@/lib/request/level";
import { DataTableStoreProvider, useFilterState } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import {
  generateColumns,
  generateFilterFields,
  generateSheetFields,
  getDefaultColumnVisibility,
} from "@/lib/table-schema";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Table as TTable } from "@tanstack/react-table";
import * as React from "react";
import { DataTableInfinite } from "@/components/data-table/data-table-infinite";
import { DataTableRefreshButton } from "@/components/data-table/data-table-refresh-button";
import { LiveButton } from "./_components/live-button";
import { dataOptions } from "./query-options";
import type { ColumnSchema, FacetMetadataSchema, FilterState } from "./schema";
import { filterSchema } from "./schema";
import type { LogsMeta } from "./query-options";
import { tableSchema } from "./table-schema";
import { TimelineChart } from "./timeline-chart";
import { timingPhasesColumn } from "./_components/timing-phases-column";
import { LiveRow } from "./_components/live-row";

// Generated from tableSchema — stable references
const columns = [
  ...generateColumns<ColumnSchema>(tableSchema.definition),
  timingPhasesColumn,
];
const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
const defaultColumnVisibility = getDefaultColumnVisibility(tableSchema.definition);

export function Client({
  defaultPrefetchEnabled = false,
}: {
  defaultPrefetchEnabled?: boolean;
}) {
  useResetFocus();
  return <NuqsClient prefetchEnabled={defaultPrefetchEnabled} />;
}

function NuqsClient({ prefetchEnabled }: { prefetchEnabled: boolean }) {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "infinite" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <ClientInner prefetchEnabled={prefetchEnabled} />
    </DataTableStoreProvider>
  );
}

function ClientInner({ prefetchEnabled }: { prefetchEnabled: boolean }) {
  const search = useFilterState<FilterState>();

  const {
    data,
    isFetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
    fetchPreviousPage,
    refetch,
  } = useInfiniteQuery(dataOptions(search));

  const flatData = React.useMemo(
    () => data?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [data?.pages],
  );

  const liveMode = useLiveMode(flatData);

  const lastPage = data?.pages?.[data?.pages.length - 1];
  const totalDBRowCount = lastPage?.meta?.totalRowCount;
  const filterDBRowCount = lastPage?.meta?.filterRowCount;
  const metadata = lastPage?.meta?.metadata;
  const chartData = lastPage?.meta?.chartData;
  const facets = lastPage?.meta?.facets;
  const totalFetched = flatData?.length;

  const { sort, start, size, uuid, cursor, direction, live, ...filter } = search;

  const dynamicFilterFields = React.useMemo(() => {
    return filterFields.map((field) => {
      const facetsField = facets?.[field.value as string];
      if (!facetsField) return field;
      if (field.options && field.options.length > 0) return field;
      const options = facetsField.rows.map(({ value }) => ({ label: `${value}`, value }));
      if (field.type === "slider") {
        return { ...field, min: facetsField.min ?? field.min, max: facetsField.max ?? field.max, options };
      }
      return { ...field, options };
    });
  }, [facets]);

  const defaultColumnFilters = React.useMemo(() => {
    return Object.entries(filter)
      .map(([key, value]) => ({ id: key, value }))
      .filter(({ value }) => {
        if (value === null || value === undefined) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      });
  }, [filter]);

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      totalRows={totalDBRowCount}
      filterRows={filterDBRowCount}
      totalRowsFetched={totalFetched}
      defaultColumnFilters={defaultColumnFilters}
      defaultColumnSorting={sort ? [sort] : undefined}
      defaultRowSelection={search.uuid ? { [search.uuid]: true } : undefined}
      defaultColumnVisibility={defaultColumnVisibility}
      meta={metadata ?? {}}
      filterFields={dynamicFilterFields}
      sheetFields={sheetFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      fetchPreviousPage={fetchPreviousPage}
      refetch={refetch}
      schema={filterSchema.definition}
      getRowClassName={(row) => {
        const rowTimestamp = row.original.date.getTime();
        const isPast = rowTimestamp <= (liveMode.timestamp || -1);
        const levelClassName = getLevelRowClassName(row.original.level);
        return cn(levelClassName, isPast ? "opacity-50" : "opacity-100");
      }}
      getRowId={(row) => row.uuid}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      renderLiveRow={(props) => {
        if (!liveMode.timestamp) return null;
        if (props?.row.original.uuid !== liveMode?.row?.uuid) return null;
        return <LiveRow colSpan={columns.length - 1} />;
      }}
      renderSheetTitle={(props) => props.row?.original.pathname}
      renderChart={() =>
        chartData ? (
          <TimelineChart data={chartData} className="-mb-2" columnId="date" />
        ) : null
      }
      renderActions={() => (
        <>
          <DataTableRefreshButton onClick={refetch} />
          {fetchPreviousPage ? (
            <LiveButton fetchPreviousPage={fetchPreviousPage} />
          ) : null}
        </>
      )}
    />
  );
}

function useResetFocus() {
  useHotKey(() => {
    document.body.setAttribute("tabindex", "0");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  }, ".");
}

export function useLiveMode<TData extends { date: Date }>(data: TData[]) {
  const live = useFilterState<FilterState, FilterState["live"]>((s) => s.live);
  const liveTimestamp = React.useRef<number | undefined>(
    live ? new Date().getTime() : undefined,
  );

  React.useEffect(() => {
    if (live) liveTimestamp.current = new Date().getTime();
    else liveTimestamp.current = undefined;
  }, [live]);

  const anchorRow = React.useMemo(() => {
    if (!live) return undefined;
    // eslint-disable-next-line react-hooks/refs
    const item = data.find((item) => {
      if (!liveTimestamp.current) return true;
      if (item.date.getTime() > liveTimestamp.current) return false;
      return true;
    });
    return item;
  }, [live, data]);

  // eslint-disable-next-line react-hooks/refs
  return { row: anchorRow, timestamp: liveTimestamp.current };
}

export function getFacetedUniqueValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): Map<string, number> => {
    return new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || [],
    );
  };
}

export function getFacetedMinMaxValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): [number, number] | undefined => {
    const min = facets?.[columnId]?.min;
    const max = facets?.[columnId]?.max;
    if (typeof min === "number" && typeof max === "number") return [min, max];
    if (typeof min === "number") return [min, min];
    if (typeof max === "number") return [max, max];
    return undefined;
  };
}
