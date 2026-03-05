# Example 2: Infinite Scroll Data Table

A server-side filtered table with `useInfiniteQuery`, URL state sync, table-schema generators, row detail sheet, live data mode, and timeline chart.

---

## What this example demonstrates

- ✅ `DataTableInfinite` with infinite scroll
- ✅ Server-side data via `useInfiniteQuery` from TanStack Query
- ✅ Declarative `tableSchema` with `createTableSchema` and `col.*` builders
- ✅ Auto-generated columns, filters, sheet fields, and column visibility
- ✅ Server-side faceted values (`getFacetedUniqueValues`, `getFacetedMinMaxValues`)
- ✅ Row detail sheet with custom renderers
- ✅ Custom display components (level indicator, latency bar, status code)
- ✅ Timeline chart (`renderChart`)
- ✅ Live data mode (`renderLiveRow`)
- ✅ Toolbar actions (refresh button, live button)
- ✅ Row className based on level and live state
- ✅ Dotted keys for nested data (`"timing.dns"`, `"timing.tls"`)
- ✅ Custom column appended to schema-generated columns

---

## File Structure

```text
src/
├── App.tsx              # Entry component — wires everything together
├── table-schema.tsx     # Declarative tableSchema with createTableSchema
├── schema.ts            # BYOS filter schema + ColumnSchema type
├── query-options.ts     # useInfiniteQuery options
├── store.ts             # Store export
├── timeline-chart.tsx   # Timeline chart component
├── skeleton.tsx         # Custom skeleton
└── components/          # Custom column & sheet components
    ├── live-button.tsx
    ├── live-row.tsx
    ├── timing-phases-column.tsx
    └── ...
```

---

## Step-by-Step

### 1. Define the Table Schema

```tsx
// table-schema.tsx
import {
  col,
  createTableSchema,
  type InferTableType,
} from "@/lib/data-grid/table-schema";

export const tableSchema = createTableSchema({
  level: col
    .enum(LEVELS)
    .label("Level")
    .display("custom", { cell: (value) => <LevelIndicator value={value} /> })
    .filterable("checkbox", {
      options: LEVELS.map((l) => ({ label: l, value: l })),
      component: (props) => <LevelOption {...props} />,
    })
    .defaultOpen()
    .size(27),

  date: col
    .timestamp()
    .label("Date")
    .display("timestamp")
    .defaultOpen()
    .commandDisabled()
    .size(200)
    .sortable()
    .sheet({
      component: (props) => format(new Date(props.date), "LLL dd, y HH:mm:ss"),
    }),

  latency: col
    .number()
    .label("Latency")
    .display("custom", { cell: (value) => <LatencyBar value={value} /> })
    .filterable("slider", { min: 0, max: 5000 })
    .size(110)
    .sortable()
    .sheet({ component: (props) => <>{props.latency}ms</> }),

  regions: col
    .array(col.enum(REGIONS))
    .label("Regions")
    .display("custom", { cell: (value) => <RegionDisplay values={value} /> })
    .filterable("checkbox", {
      options: REGIONS.map((r) => ({ label: r, value: r })),
    })
    .size(163)
    .sheet({ component: (props) => <RegionFlag value={props.regions[0]} /> }),

  // Dotted keys for nested data:
  "timing.dns": col
    .number()
    .label("DNS")
    .filterable("slider", { min: 0, max: 5000 })
    .hidden(),
  "timing.tls": col
    .number()
    .label("TLS")
    .filterable("slider", { min: 0, max: 5000 })
    .hidden(),

  headers: col
    .record()
    .label("Headers")
    .notFilterable()
    .hidden()
    .sheet({ component: (props) => <KVTabs data={props.headers} /> }),
});
```

### 2. Generate Columns, Filters, Sheet Fields

```tsx
// App.tsx
const columns = [
  ...generateColumns<ColumnSchema>(tableSchema.definition),
  timingPhasesColumn, // custom column appended manually
];
const filterFields = generateFilterFields<ColumnSchema>(tableSchema.definition);
const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
const defaultColumnVisibility = getDefaultColumnVisibility(
  tableSchema.definition,
);
```

### 3. Define the BYOS Filter Schema

```ts
// schema.ts
export const filterSchema = createSchema({
  ...generateFilterSchema(tableSchema).definition,
  sort: field.sort(),
  uuid: field.string(),
  live: field.boolean().default(false),
  start: field.number(),
  size: field.number().default(10),
  cursor: field.string(),
  direction: field.stringLiteral(["forward", "backward"] as const),
});
```

### 4. Wire Up `useInfiniteQuery`

```tsx
function App() {
  const search = useFilterState<FilterState>();

  const { data, isFetching, isLoading, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery(dataOptions(search));

  const flatData = data?.pages?.flatMap((page) => page.data ?? []) ?? [];
  const lastPage = data?.pages?.[data.pages.length - 1];

  return (
    <DataTableInfinite
      columns={columns}
      data={flatData}
      totalRows={lastPage?.meta?.totalRowCount}
      filterRows={lastPage?.meta?.filterRowCount}
      totalRowsFetched={flatData.length}
      defaultColumnFilters={Object.entries(filter)
        .map(([key, value]) => ({ id: key, value }))
        .filter(({ value }) => value != null)}
      defaultColumnSorting={search.sort ? [search.sort] : undefined}
      defaultRowSelection={search.uuid ? { [search.uuid]: true } : undefined}
      defaultColumnVisibility={defaultColumnVisibility}
      meta={metadata ?? {}}
      filterFields={dynamicFilterFields}
      sheetFields={sheetFields}
      isFetching={isFetching}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      refetch={refetch}
      schema={filterSchema.definition}
      getRowId={(row) => row.uuid}
      getRowClassName={(row) => cn(getLevelRowClassName(row.original.level))}
      getFacetedUniqueValues={getFacetedUniqueValues(facets)}
      getFacetedMinMaxValues={getFacetedMinMaxValues(facets)}
      renderSheetTitle={({ row }) => row?.original.pathname}
      renderChart={() => <TimelineChart data={chartData} columnId="date" />}
      renderActions={() => (
        <>
          <DataTableRefreshButton onClick={refetch} />
          <LiveButton fetchPreviousPage={fetchPreviousPage} />
        </>
      )}
    />
  );
}
```

### 5. Server-Side Facets

```tsx
function getFacetedUniqueValues(facets) {
  return (_, columnId) =>
    new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || [],
    );
}

function getFacetedMinMaxValues(facets) {
  return (_, columnId) => {
    const { min, max } = facets?.[columnId] ?? {};
    return typeof min === "number" && typeof max === "number"
      ? [min, max]
      : undefined;
  };
}
```

---

## Key Takeaways

1. **Schema-driven** — One `tableSchema` generates columns, filters, sheet fields, and visibility.
2. **Server facets** — Faceted values come from the API, not computed client-side.
3. **Dynamic filter fields** — Filter options update from server-provided facets.
4. **Composable** — Custom columns and render slots extend the generated code.
5. **Full State sync** — Every filter, sort, row selection, and live mode flag synced to state.
