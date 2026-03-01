# Component Extraction & Nuqs-Only Refactor — Design

## Goal

Extract the core table components (`DataTable`, `DataTableInfinite`, `DataTableTree`) from route-specific folders into `src/components/data-table/`, creating a generic, registry-installable component library. Simplify routes to nuqs-only (drop Zustand adapter toggle from client.tsx). Registry.json points only to `src/components/data-table/` and `src/lib/store/`.

## Architecture

### File Structure After Refactor

```
src/components/data-table/
├── data-table.tsx            ← NEW: base table (moved + enriched from default/data-table.tsx)
├── data-table-tree.tsx       ← NEW: tree extension (moved from tree/data-table.tsx)
├── data-table-infinite.tsx   ← MOVED: from infinite/data-table-infinite.tsx
│
├── (existing — unchanged)
├── data-table-provider.tsx
├── data-table-toolbar.tsx
├── data-table-filter-controls.tsx
├── data-table-filter-controls-drawer.tsx
├── data-table-pagination.tsx
├── data-table-filter-checkbox.tsx
├── data-table-filter-input.tsx
├── data-table-filter-slider.tsx
├── data-table-filter-timerange.tsx
├── data-table-filter-command/
├── data-table-filter-reset-button.tsx
├── data-table-reset-button.tsx
├── data-table-column-header.tsx
├── data-table-skeleton.tsx
├── data-table-view-options.tsx
├── data-table-store-sync.tsx
├── data-table-cell/
├── data-table-column/
├── data-table-sheet/
├── types.ts
└── utils.ts

src/app/
├── default/   → columns.tsx, schema.ts, data.ts, client.tsx (nuqs only), page.tsx
├── tree/      → columns.tsx, schema.ts, data.ts, client.tsx (nuqs only), page.tsx
├── infinite/  → schema.ts, api/, client.tsx (nuqs only), page.tsx
```

### Composable Props Hierarchy

```
DataTableProps<TData, TValue>          ← base (rich, all optional features)
    ↓ extends
DataTableInfiniteProps<TData, TValue, TMeta>  ← makes fetch/refetch/meta required
    ↓ extends
DataTableTreeProps<TData, TValue, TMeta>      ← adds getSubRows + filterFromLeafRows
```

Tree supports static data, paginated data, AND infinite scroll — it inherits all infinite props, making scroll support opt-in (optional fields from base).

## Props Interface

### DataTableProps (base)

```typescript
interface DataTableProps<TData, TValue> {
  // Core
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  filterFields?: DataTableFilterField<TData>[];

  // State defaults
  defaultColumnFilters?: ColumnFiltersState;
  defaultSorting?: SortingState;
  defaultColumnVisibility?: VisibilityState;
  defaultRowSelection?: RowSelectionState;
  defaultPagination?: PaginationState;

  // Row behavior
  getRowId?: TableOptions<TData>["getRowId"];
  getRowClassName?: (row: Row<TData>) => string;

  // Server-side facets
  getFacetedUniqueValues?: (table: Table<TData>, columnId: string) => Map<string, number>;
  getFacetedMinMaxValues?: (table: Table<TData>, columnId: string) => [number, number] | undefined;

  // Column features
  enableColumnOrdering?: boolean;
  enableColumnResizing?: boolean;

  // Loading / fetch state
  isLoading?: boolean;
  isFetching?: boolean;
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;

  // Infinite scroll (optional in base, required in DataTableInfiniteProps)
  hasNextPage?: boolean;
  fetchNextPage?: (options?: FetchNextPageOptions) => Promise<unknown>;
  fetchPreviousPage?: (options?: FetchPreviousPageOptions) => Promise<unknown>;
  refetch?: (options?: RefetchOptions) => void;

  // Sheet / detail panel
  sheetFields?: SheetField<TData>[];
  renderSheetTitle?: (props: { row?: Row<TData> }) => React.ReactNode;

  // Chart & live row (advanced)
  meta?: unknown;
  chartData?: BaseChartSchema[];
  chartDataColumnId?: string;
  renderLiveRow?: (props?: { row: Row<TData> }) => React.ReactNode;
  renderChart?: () => React.ReactNode;

  // BYOS
  schema: SchemaDefinition;
  tableId?: string;
}
```

### DataTableInfiniteProps (extends base)

Adds `fetchNextPage`, `refetch`, and `meta` as required.

```typescript
interface DataTableInfiniteProps<TData, TValue, TMeta>
  extends DataTableProps<TData, TValue> {
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
  refetch: (options?: RefetchOptions) => void;
  meta: TMeta;
}
```

### DataTableTreeProps (extends infinite)

```typescript
interface DataTableTreeProps<TData extends { children?: TData[] }, TValue, TMeta>
  extends DataTableInfiniteProps<TData, TValue, TMeta> {
  getSubRows?: (row: TData) => TData[] | undefined;  // default: row => row.children
  filterFromLeafRows?: boolean;                       // default: true
}
```

## Route Pattern After Refactor

All three routes follow the same thin wrapper pattern:

```tsx
// src/app/default/client.tsx
"use client";
import { DataTable } from "@/components/data-table/data-table";
import { useNuqsAdapter, DataTableStoreProvider } from "@/lib/store";
import { columns } from "./columns";
import { data } from "./data";
import { filterFields } from "./constants";
import { filterSchema } from "./schema";

export function Client() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "default" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable
        columns={columns}
        data={data}
        filterFields={filterFields}
        schema={filterSchema.definition}
        tableId="default"
      />
    </DataTableStoreProvider>
  );
}
```

Tree and Infinite follow identical patterns, importing `DataTableTree` and `DataTableInfinite` respectively.

## Registry

`registry.json` exposes only `src/components/data-table/` and `src/lib/store/`:

- `data-table` — base block (all generic filter/toolbar/pagination + new `data-table.tsx`)
- `data-table-infinite` — block, `registryDependencies: ["data-table"]`
- `data-table-tree` — block, `registryDependencies: ["data-table"]`

Route-specific files (`columns.tsx`, `schema.ts`, `data.ts`) are NOT in the registry.

## What Changes

| File | Action |
|------|--------|
| `src/app/default/data-table.tsx` | Deleted (logic moves to component) |
| `src/app/tree/data-table.tsx` | Deleted (logic moves to component) |
| `src/app/infinite/data-table-infinite.tsx` | Moved to `src/components/data-table/data-table-infinite.tsx` |
| `src/app/default/client.tsx` | Simplified: nuqs only, imports from components |
| `src/app/tree/client.tsx` | Simplified: nuqs only, imports from components |
| `src/app/infinite/client.tsx` | Simplified: nuqs only, imports from components |
| `src/components/data-table/data-table.tsx` | NEW: base generic table |
| `src/components/data-table/data-table-tree.tsx` | NEW: tree extension |
| `src/components/data-table/data-table-infinite.tsx` | NEW: moved from route |
| `registry.json` | Updated: components only, no route files |

## What Does NOT Change

- `src/lib/store/` — entire BYOS system unchanged (nuqs adapter stays, zustand adapter stays in lib but not exposed through routes)
- `src/components/data-table/` existing files — all filter/toolbar/pagination/cell components unchanged
- Route-specific: `columns.tsx`, `schema.ts`, `data.ts`, `page.tsx`, `layout.tsx`, `skeleton.tsx` — unchanged
- `src/app/infinite/api/` — unchanged
- `src/app/infinite/_components/` — unchanged

## Tech Stack

- TanStack Table v8 (getSubRows, filterFromLeafRows, getExpandedRowModel)
- nuqs v2 (URL state management)
- Next.js 16 with React 19
- TypeScript generic components with full type inference
