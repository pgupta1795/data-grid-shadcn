# Component Extraction & Nuqs-Only Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract `DataTable`, `DataTableTree`, and `DataTableInfinite` from route folders into `src/components/data-table/`, use nuqs-only in route `client.tsx` files, and update `registry.json` to expose only the components folder.

**Architecture:** Props hierarchy: `DataTableProps` (rich base) → `DataTableInfiniteProps` (required scroll) → `DataTableTreeProps` (adds tree options, relaxes required scroll props). Routes become thin wrappers importing from `@/components/data-table/`.

**Tech Stack:** TanStack Table v8, nuqs v2, Next.js 16, React 19, TypeScript generics.

---

### Task 1: Add `BaseChartSchema` type to `src/components/data-table/types.ts`

**Files:**
- Modify: `src/components/data-table/types.ts`

**Context:** `BaseChartSchema` is currently in `src/app/infinite/schema.ts` but will be needed by `DataTableInfinite` which moves to components. The type is `{ timestamp: number; [key: string]: number }`.

**Step 1: Open and read the file**

Read `src/components/data-table/types.ts` (already done — it ends at line 92).

**Step 2: Append `BaseChartSchema` at the bottom**

Add to the end of `src/components/data-table/types.ts`:

```typescript
/** Generic chart data row: timestamp + any numeric keys (e.g. error, warning, success counts). */
export type BaseChartSchema = { timestamp: number; [key: string]: number };
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 2: Move `RefreshButton` to `src/components/data-table/`

**Files:**
- Create: `src/components/data-table/data-table-refresh-button.tsx`
- (Do NOT delete `src/app/infinite/_components/refresh-button.tsx` yet — infinite client still uses it until Task 8)

**Context:** `RefreshButton` is a generic loading-aware refresh icon button. It reads `isLoading` from `useDataTable()` context. No route-specific imports.

**Step 1: Create the file**

Create `src/components/data-table/data-table-refresh-button.tsx`:

```typescript
"use client";

import { useDataTable } from "@/components/data-table/data-table-provider";
import { Button } from "@/components/ui/button";
import { LoaderCircle, RefreshCcw } from "lucide-react";

interface DataTableRefreshButtonProps {
  onClick: () => void;
}

export function DataTableRefreshButton({ onClick }: DataTableRefreshButtonProps) {
  const { isLoading } = useDataTable();

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={isLoading}
      onClick={onClick}
      className="h-9 w-9"
    >
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}
      <span className="sr-only">Refresh data</span>
    </Button>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 3: Create `src/components/data-table/data-table.tsx` (base generic table)

**Files:**
- Create: `src/components/data-table/data-table.tsx`
- (Do NOT delete `src/app/default/data-table.tsx` yet — default route still uses it until Task 6)

**Context:** This replaces `src/app/default/data-table.tsx`. Key differences:
1. Generic `<TData, TValue>` (not hardcoded types)
2. `schema` prop replaces hardcoded `import { filterSchema } from "./schema"`
3. `tableId` is a required prop (no default needed — caller always provides it)
4. Rich props interface matching design (most optional)
5. `renderActions` prop forwarded to DataTableToolbar

**Step 1: Create the file**

Create `src/components/data-table/data-table.tsx`:

```typescript
"use client";

// REMINDER: React Compiler is not compatible with TanStack Table v8
// https://github.com/TanStack/table/issues/5567
"use no memo";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableProvider } from "@/components/data-table/data-table-provider";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { DataTableFilterField, SheetField } from "@/components/data-table/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getColumnVisibilityKey } from "@/lib/constants/local-storage";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import { cn } from "@/lib/utils";
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  TableOptions,
  Table as TTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { FetchNextPageOptions, FetchPreviousPageOptions, RefetchOptions } from "@tanstack/react-query";
import * as React from "react";

export interface DataTableProps<TData, TValue> {
  // ── Core ──────────────────────────────────────────────────────────────────
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  filterFields?: DataTableFilterField<TData>[];
  // BYOS — required so component is not coupled to a specific schema
  schema: SchemaDefinition;
  tableId: string;

  // ── State defaults ────────────────────────────────────────────────────────
  defaultColumnFilters?: ColumnFiltersState;
  defaultSorting?: SortingState;
  defaultColumnVisibility?: VisibilityState;
  defaultRowSelection?: RowSelectionState;
  defaultPagination?: PaginationState;

  // ── Row behaviour ─────────────────────────────────────────────────────────
  getRowId?: TableOptions<TData>["getRowId"];
  getRowClassName?: (row: Row<TData>) => string;

  // ── Server-side facets ────────────────────────────────────────────────────
  getFacetedUniqueValues?: (
    table: TTable<TData>,
    columnId: string,
  ) => Map<string, number>;
  getFacetedMinMaxValues?: (
    table: TTable<TData>,
    columnId: string,
  ) => [number, number] | undefined;

  // ── Column features ───────────────────────────────────────────────────────
  enableColumnOrdering?: boolean;
  enableColumnResizing?: boolean;

  // ── Loading / fetch state ─────────────────────────────────────────────────
  isLoading?: boolean;
  isFetching?: boolean;
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;

  // ── Infinite scroll (optional — use DataTableInfinite for full support) ───
  hasNextPage?: boolean;
  fetchNextPage?: (options?: FetchNextPageOptions) => Promise<unknown>;
  fetchPreviousPage?: (options?: FetchPreviousPageOptions) => Promise<unknown>;
  refetch?: (options?: RefetchOptions) => void;

  // ── Sheet / detail panel ──────────────────────────────────────────────────
  sheetFields?: SheetField<TData>[];
  renderSheetTitle?: (props: { row?: Row<TData> }) => React.ReactNode;

  // ── Render slots ──────────────────────────────────────────────────────────
  /** Passed to DataTableToolbar — renders after the reset button and before view options */
  renderActions?: () => React.ReactNode;
  /** Renders below the toolbar, above the table (e.g. a chart) */
  renderChart?: () => React.ReactNode;
  /** Renders at the bottom of the sidebar (e.g. a footer) */
  renderSidebarFooter?: () => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  defaultColumnFilters = [],
  defaultSorting = [],
  defaultColumnVisibility = {},
  defaultPagination = { pageIndex: 0, pageSize: 10 },
  filterFields = [],
  getFacetedUniqueValues: externalGetFacetedUniqueValues,
  getFacetedMinMaxValues: externalGetFacetedMinMaxValues,
  isLoading,
  schema,
  tableId,
  renderActions,
  renderChart,
  renderSidebarFooter,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] =
    React.useState<SortingState>(defaultSorting);
  const [pagination, setPagination] =
    React.useState<PaginationState>(defaultPagination);
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>(
      getColumnVisibilityKey(tableId),
      defaultColumnVisibility,
    );

  // Reset pagination when filters change to avoid showing empty pages
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  // Custom getFacetedUniqueValues that handles array column values
  const customGetFacetedUniqueValues = React.useCallback(
    (table: TTable<TData>, columnId: string) => () => {
      const facets = getFacetedUniqueValues<TData>()(table, columnId)();
      const customFacets = new Map();
      for (const [key, value] of facets as Map<unknown, number>) {
        if (Array.isArray(key)) {
          for (const k of key) {
            customFacets.set(k, (customFacets.get(k) || 0) + value);
          }
        } else {
          customFacets.set(key, (customFacets.get(key) || 0) + value);
        }
      }
      return customFacets;
    },
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: customGetFacetedUniqueValues,
    enableFilters: true,
    enableColumnFilters: true,
  });

  // Adapter signature for DataTableProvider
  const getFacetedUniqueValuesForProvider = React.useCallback(
    (table: TTable<TData>, columnId: string): Map<string, number> => {
      // Prefer externally-provided (server-side) facets over computed ones
      if (externalGetFacetedUniqueValues) {
        return externalGetFacetedUniqueValues(table, columnId);
      }
      return customGetFacetedUniqueValues(table, columnId)();
    },
    [customGetFacetedUniqueValues, externalGetFacetedUniqueValues],
  );

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      pagination={pagination}
      isLoading={isLoading}
      getFacetedUniqueValues={getFacetedUniqueValuesForProvider}
      getFacetedMinMaxValues={externalGetFacetedMinMaxValues}
    >
      <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "hidden w-full p-1 sm:block sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-64 md:max-w-64",
            "group-data-[expanded=false]/controls:hidden",
          )}
        >
          <DataTableFilterControls />
          {renderSidebarFooter?.()}
        </div>
        <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
          <DataTableFilterCommand schema={schema} tableId={tableId} />
          {renderChart?.()}
          <DataTableToolbar renderActions={renderActions} />
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination />
        </div>
      </div>
    </DataTableProvider>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 4: Create `src/components/data-table/data-table-tree.tsx`

**Files:**
- Create: `src/components/data-table/data-table-tree.tsx`
- (Do NOT delete `src/app/tree/data-table.tsx` yet)

**Context:** Extends `DataTableInfiniteProps` but relaxes the required `fetchNextPage`, `refetch`, and `meta` props back to optional (tree can work with static data). Adds `getSubRows` and `filterFromLeafRows`. Generic `<TData, TValue>` — no hardcoded TreeNode.

**Step 1: Create the file**

Create `src/components/data-table/data-table-tree.tsx`:

```typescript
"use client";

// REMINDER: React Compiler is not compatible with TanStack Table v8
// https://github.com/TanStack/table/issues/5567
"use no memo";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableProvider } from "@/components/data-table/data-table-provider";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { DataTableFilterField, SheetField } from "@/components/data-table/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getColumnVisibilityKey } from "@/lib/constants/local-storage";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import { cn } from "@/lib/utils";
import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  TableOptions,
  Table as TTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { FetchNextPageOptions, FetchPreviousPageOptions, RefetchOptions } from "@tanstack/react-query";
import * as React from "react";

/**
 * DataTableTreeProps extends the full infinite-capable props interface but makes
 * fetchNextPage / refetch / meta optional — tree tables work with static data.
 * Pass those props to enable infinite-scroll or manual-pagination in a tree table.
 */
export interface DataTableTreeProps<TData, TValue, TMeta = Record<string, unknown>> {
  // ── Core ──────────────────────────────────────────────────────────────────
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  filterFields?: DataTableFilterField<TData>[];
  schema: SchemaDefinition;
  tableId: string;

  // ── Tree-specific ─────────────────────────────────────────────────────────
  /** Return the children for a given row. Defaults to `(row) => (row as any).children`. */
  getSubRows?: (row: TData) => TData[] | undefined;
  /** Keep ancestor rows visible when any descendant matches. Defaults to true. */
  filterFromLeafRows?: boolean;

  // ── State defaults ────────────────────────────────────────────────────────
  defaultColumnFilters?: ColumnFiltersState;
  defaultSorting?: SortingState;
  defaultColumnVisibility?: VisibilityState;
  defaultRowSelection?: RowSelectionState;
  defaultPagination?: PaginationState;

  // ── Row behaviour ─────────────────────────────────────────────────────────
  getRowId?: TableOptions<TData>["getRowId"];
  getRowClassName?: (row: Row<TData>) => string;

  // ── Server-side facets ────────────────────────────────────────────────────
  getFacetedUniqueValues?: (table: TTable<TData>, columnId: string) => Map<string, number>;
  getFacetedMinMaxValues?: (table: TTable<TData>, columnId: string) => [number, number] | undefined;

  // ── Column features ───────────────────────────────────────────────────────
  enableColumnOrdering?: boolean;
  enableColumnResizing?: boolean;

  // ── Loading / fetch state ─────────────────────────────────────────────────
  isLoading?: boolean;
  isFetching?: boolean;
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;

  // ── Infinite scroll support (optional — enables scrolling in tree tables) ─
  hasNextPage?: boolean;
  fetchNextPage?: (options?: FetchNextPageOptions) => Promise<unknown>;
  fetchPreviousPage?: (options?: FetchPreviousPageOptions) => Promise<unknown>;
  refetch?: (options?: RefetchOptions) => void;
  meta?: TMeta;

  // ── Sheet / detail panel ──────────────────────────────────────────────────
  sheetFields?: SheetField<TData>[];
  renderSheetTitle?: (props: { row?: Row<TData> }) => React.ReactNode;

  // ── Render slots ──────────────────────────────────────────────────────────
  renderActions?: () => React.ReactNode;
  renderChart?: () => React.ReactNode;
  renderSidebarFooter?: () => React.ReactNode;
}

export function DataTableTree<TData, TValue, TMeta = Record<string, unknown>>({
  columns,
  data,
  defaultColumnFilters = [],
  defaultSorting = [],
  defaultColumnVisibility = {},
  defaultPagination = { pageIndex: 0, pageSize: 10 },
  filterFields = [],
  getFacetedUniqueValues: externalGetFacetedUniqueValues,
  getFacetedMinMaxValues: externalGetFacetedMinMaxValues,
  getSubRows,
  filterFromLeafRows = true,
  isLoading,
  schema,
  tableId,
  renderActions,
  renderChart,
  renderSidebarFooter,
}: DataTableTreeProps<TData, TValue, TMeta>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] =
    React.useState<SortingState>(defaultSorting);
  const [pagination, setPagination] =
    React.useState<PaginationState>(defaultPagination);
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>(
      getColumnVisibilityKey(tableId),
      defaultColumnVisibility,
    );

  // Reset pagination to page 0 when filters change
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  // Custom getFacetedUniqueValues that handles array values
  const customGetFacetedUniqueValues = React.useCallback(
    (table: TTable<TData>, columnId: string) => () => {
      const facets = getFacetedUniqueValues<TData>()(table, columnId)();
      const customFacets = new Map();
      for (const [key, value] of facets as Map<unknown, number>) {
        if (Array.isArray(key)) {
          for (const k of key) {
            customFacets.set(k, (customFacets.get(k) || 0) + value);
          }
        } else {
          customFacets.set(key, (customFacets.get(key) || 0) + value);
        }
      }
      return customFacets;
    },
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, columnVisibility, pagination, expanded },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    // ── Tree options ──────────────────────────────────────────────────────────
    getSubRows: getSubRows ?? ((row) => (row as Record<string, unknown>).children as TData[] | undefined),
    filterFromLeafRows,
    getExpandedRowModel: getExpandedRowModel(),
    // ── Standard row models ───────────────────────────────────────────────────
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: customGetFacetedUniqueValues,
    enableFilters: true,
    enableColumnFilters: true,
  });

  const getFacetedUniqueValuesForProvider = React.useCallback(
    (table: TTable<TData>, columnId: string): Map<string, number> => {
      if (externalGetFacetedUniqueValues) {
        return externalGetFacetedUniqueValues(table, columnId);
      }
      return customGetFacetedUniqueValues(table, columnId)();
    },
    [customGetFacetedUniqueValues, externalGetFacetedUniqueValues],
  );

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      pagination={pagination}
      isLoading={isLoading}
      getFacetedUniqueValues={getFacetedUniqueValuesForProvider}
      getFacetedMinMaxValues={externalGetFacetedMinMaxValues}
    >
      <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "hidden w-full p-1 sm:block sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-64 md:max-w-64",
            "group-data-[expanded=false]/controls:hidden",
          )}
        >
          <DataTableFilterControls />
          {renderSidebarFooter?.()}
        </div>
        <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
          <DataTableFilterCommand schema={schema} tableId={tableId} />
          {renderChart?.()}
          <DataTableToolbar renderActions={renderActions} />
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination />
        </div>
      </div>
    </DataTableProvider>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 5: Create `src/components/data-table/data-table-infinite.tsx`

**Files:**
- Create: `src/components/data-table/data-table-infinite.tsx`
- (Do NOT delete `src/app/infinite/data-table-infinite.tsx` yet)

**Context:** Moved from `src/app/infinite/data-table-infinite.tsx`. Key changes:
1. Remove `SocialsFooter` (demo-specific — not generic)
2. Remove `adapterType`, `prefetchEnabled`, `showConfigurationDropdown` props (demo-only)
3. Replace `<TimelineChart>` with `renderChart?.()` (chart stays in route, passed as render prop)
4. Replace internal `RefreshButton`/`LiveButton` rendering with `renderActions` prop passed to DataTableToolbar
5. Import `DataTableRefreshButton` from components (but don't render it — route handles this)
6. Import `BaseChartSchema` from `@/components/data-table/types` instead of route schema
7. Update all relative imports to absolute `@/` paths

**Step 1: Create the file**

Create `src/components/data-table/data-table-infinite.tsx`:

```typescript
"use client";

// REMINDER: React Compiler is not compatible with TanStack Table v8
// https://github.com/TanStack/table/issues/5567
"use no memo";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import { DataTableProvider } from "@/components/data-table/data-table-provider";
import { DataTableResetButton } from "@/components/data-table/data-table-reset-button";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { BaseChartSchema, DataTableFilterField, SheetField } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { useHotKey } from "@/hooks/use-hot-key";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  getColumnOrderKey,
  getColumnVisibilityKey,
} from "@/lib/constants/local-storage";
import { formatCompactNumber } from "@/lib/format";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import { arrSome, inDateRange } from "@/lib/table/filterfns";
import { cn } from "@/lib/utils";
import type {
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  RefetchOptions,
} from "@tanstack/react-query";
import type {
  ColumnDef,
  ColumnFiltersState,
  Row,
  RowSelectionState,
  SortingState,
  TableOptions,
  Table as TTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues as getTTableFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues as getTTableFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { LoaderCircle } from "lucide-react";
import * as React from "react";

export interface DataTableInfiniteProps<TData, TValue, TMeta> {
  // ── Core ──────────────────────────────────────────────────────────────────
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  schema: SchemaDefinition;
  tableId?: string;

  // ── Required scroll props ─────────────────────────────────────────────────
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
  refetch: (options?: RefetchOptions) => void;
  meta: TMeta;

  // ── State defaults ────────────────────────────────────────────────────────
  defaultColumnFilters?: ColumnFiltersState;
  defaultColumnSorting?: SortingState;
  defaultRowSelection?: RowSelectionState;
  defaultColumnVisibility?: VisibilityState;

  // ── Filter / facet ────────────────────────────────────────────────────────
  filterFields?: DataTableFilterField<TData>[];
  sheetFields?: SheetField<TData, TMeta>[];
  getFacetedUniqueValues?: (table: TTable<TData>, columnId: string) => Map<string, number>;
  getFacetedMinMaxValues?: (table: TTable<TData>, columnId: string) => [number, number] | undefined;

  // ── Row options ───────────────────────────────────────────────────────────
  getRowClassName?: (row: Row<TData>) => string;
  getRowId?: TableOptions<TData>["getRowId"];

  // ── Counts / loading ──────────────────────────────────────────────────────
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;
  isFetching?: boolean;
  isLoading?: boolean;
  hasNextPage?: boolean;
  fetchPreviousPage?: (options?: FetchPreviousPageOptions) => Promise<unknown>;

  // ── Chart ─────────────────────────────────────────────────────────────────
  /** @deprecated Use renderChart instead. Kept for backwards compatibility. */
  chartData?: BaseChartSchema[];
  chartDataColumnId?: string;

  // ── Render slots ──────────────────────────────────────────────────────────
  renderLiveRow?: (props?: { row: Row<TData> }) => React.ReactNode;
  renderSheetTitle: (props: { row?: Row<TData> }) => React.ReactNode;
  /** Renders below the command bar, above the table header */
  renderChart?: () => React.ReactNode;
  /** Passed to DataTableToolbar — renders after reset button, before view options */
  renderActions?: () => React.ReactNode;
  /** Renders at the bottom of the sidebar */
  renderSidebarFooter?: () => React.ReactNode;
}

export function DataTableInfinite<TData, TValue, TMeta>({
  columns,
  getRowClassName,
  getRowId,
  data,
  defaultColumnFilters = [],
  defaultColumnSorting = [],
  defaultRowSelection = {},
  defaultColumnVisibility = {},
  filterFields = [],
  sheetFields = [],
  isFetching,
  isLoading,
  fetchNextPage,
  hasNextPage,
  fetchPreviousPage,
  refetch,
  totalRows = 0,
  filterRows = 0,
  totalRowsFetched = 0,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  meta,
  renderLiveRow,
  renderSheetTitle,
  renderChart,
  renderActions,
  renderSidebarFooter,
  schema,
  tableId = "infinite",
}: DataTableInfiniteProps<TData, TValue, TMeta>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] =
    React.useState<SortingState>(defaultColumnSorting);
  const [rowSelection, setRowSelection] =
    React.useState<RowSelectionState>(defaultRowSelection);
  const [columnOrder, setColumnOrder] = useLocalStorage<string[]>(
    getColumnOrderKey(tableId),
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>(
      getColumnVisibilityKey(tableId),
      defaultColumnVisibility,
    );
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [topBarHeight, setTopBarHeight] = React.useState(0);

  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const onPageBottom =
        Math.ceil(e.currentTarget.scrollTop + e.currentTarget.clientHeight) >=
        e.currentTarget.scrollHeight;
      if (onPageBottom && !isFetching && totalRowsFetched < filterRows) {
        fetchNextPage();
      }
    },
    [fetchNextPage, isFetching, filterRows, totalRowsFetched],
  );

  React.useEffect(() => {
    const observer = new ResizeObserver(() => {
      const rect = topBarRef.current?.getBoundingClientRect();
      if (rect) setTopBarHeight(rect.height);
    });
    const topBar = topBarRef.current;
    if (!topBar) return;
    observer.observe(topBar);
    return () => observer.unobserve(topBar);
  }, [topBarRef]);

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, columnVisibility, rowSelection, columnOrder },
    enableMultiRowSelection: false,
    columnResizeMode: "onChange",
    getRowId,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getTTableFacetedUniqueValues(),
    getFacetedMinMaxValues: getTTableFacetedMinMaxValues(),
    filterFns: { inDateRange, arrSome },
    debugAll: process.env.NEXT_PUBLIC_TABLE_DEBUG === "true",
    meta: { getRowClassName },
  });

  const selectedRow = React.useMemo(() => {
    if ((isLoading || isFetching) && !data.length) return;
    const selectedRowKey = Object.keys(rowSelection)?.[0];
    return table.getCoreRowModel().flatRows.find((row) => row.id === selectedRowKey);
  }, [rowSelection, table, isLoading, isFetching, data]);

  React.useEffect(() => {
    if (isLoading || isFetching) return;
    if (Object.keys(rowSelection)?.length && !selectedRow) {
      setRowSelection({});
    }
  }, [rowSelection, selectedRow, isLoading, isFetching]);

  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: string } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id.replace(".", "-")}-size`] = `${header.getSize()}px`;
      colSizes[`--col-${header.column.id.replace(".", "-")}-size`] = `${header.column.getSize()}px`;
    }
    return colSizes;
  }, [
    table.getState().columnSizingInfo,
    table.getState().columnSizing,
    table.getState().columnVisibility,
  ]);

  useHotKey(() => {
    setColumnOrder([]);
    setColumnVisibility(defaultColumnVisibility);
  }, "u");

  const visibleColumnIds = React.useMemo(
    () => table.getVisibleLeafColumns().map((c) => c.id).join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getState().columnVisibility],
  );
  const columnOrderString = React.useMemo(() => columnOrder.join(","), [columnOrder]);

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      rowSelection={rowSelection}
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      enableColumnOrdering={true}
      isLoading={isFetching || isLoading}
      getFacetedUniqueValues={getFacetedUniqueValues}
      getFacetedMinMaxValues={getFacetedMinMaxValues}
    >
      <div
        className="flex h-full min-h-screen w-full flex-col sm:flex-row"
        style={
          {
            "--top-bar-height": `${topBarHeight}px`,
            ...columnSizeVars,
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "h-full w-full flex-col sm:sticky sm:top-0 sm:max-h-screen sm:min-h-screen sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-72 md:max-w-72",
            "group-data-[expanded=false]/controls:hidden",
            "hidden sm:flex",
          )}
        >
          <div className="border-b border-border bg-background p-2 md:sticky md:top-0">
            <div className="flex h-[46px] items-center justify-between gap-3">
              <p className="px-2 font-medium text-foreground">Filters</p>
              <div>
                {table.getState().columnFilters.length ? <DataTableResetButton /> : null}
              </div>
            </div>
          </div>
          <div className="flex-1 p-2 sm:overflow-y-scroll">
            <DataTableFilterControls />
          </div>
          {renderSidebarFooter && (
            <div className="border-t border-border bg-background p-4 md:sticky md:bottom-0">
              {renderSidebarFooter()}
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex max-w-full flex-1 flex-col border-border sm:border-l",
            "group-data-[expanded=true]/controls:sm:max-w-[calc(100vw_-_208px)] group-data-[expanded=true]/controls:md:max-w-[calc(100vw_-_288px)]",
          )}
        >
          <div
            ref={topBarRef}
            className={cn(
              "flex flex-col gap-4 bg-background p-2",
              "sticky top-0 z-10 pb-4",
            )}
          >
            <DataTableFilterCommand schema={schema} tableId={tableId} />
            <DataTableToolbar renderActions={renderActions} />
            {renderChart?.()}
          </div>
          <div className="z-0">
            <Table
              ref={tableRef}
              onScroll={onScroll}
              className="border-separate border-spacing-0"
              containerClassName="max-h-[calc(100vh_-_var(--top-bar-height))]"
            >
              <TableHeader className={cn("sticky top-0 z-20 bg-background")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className={cn(
                      "bg-muted/50 hover:bg-muted/50",
                      "[&>*]:border-t [&>:not(:last-child)]:border-r",
                    )}
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "relative select-none truncate border-b border-border [&>.cursor-col-resize]:last:opacity-0",
                          header.column.columnDef.meta?.headerClassName,
                        )}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : "none"
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() && (
                          <div
                            onDoubleClick={() => header.column.resetSize()}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "user-select-none absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none justify-center",
                              "before:absolute before:inset-y-0 before:w-px before:translate-x-px before:bg-border",
                            )}
                          />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody
                id="content"
                tabIndex={-1}
                className="outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:outline"
                style={{ scrollMarginTop: "calc(var(--top-bar-height) + 40px)" }}
              >
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                      {renderLiveRow?.({ row })}
                      <MemoizedRow
                        row={row}
                        table={table}
                        selected={row.getIsSelected()}
                        visibleColumnIds={visibleColumnIds}
                        columnOrder={columnOrderString}
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <React.Fragment>
                    {renderLiveRow?.()}
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results.
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )}
                <TableRow className="hover:bg-transparent data-[state=selected]:bg-transparent">
                  <TableCell colSpan={columns.length} className="text-center">
                    {hasNextPage || isFetching || isLoading ? (
                      <Button
                        disabled={isFetching || isLoading}
                        onClick={() => fetchNextPage()}
                        size="sm"
                        variant="outline"
                      >
                        {isFetching ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Load More
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No more data to load (
                        <span className="font-mono font-medium">
                          {formatCompactNumber(filterRows)}
                        </span>{" "}
                        of{" "}
                        <span className="font-mono font-medium">
                          {formatCompactNumber(totalRows)}
                        </span>{" "}
                        rows)
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      <DataTableSheetDetails
        title={renderSheetTitle({ row: selectedRow })}
        titleClassName="font-mono"
      >
        <MemoizedDataTableSheetContent
          table={table}
          data={selectedRow?.original}
          filterFields={filterFields}
          fields={sheetFields}
          metadata={{
            totalRows,
            filterRows,
            totalRowsFetched,
            ...meta,
          }}
        />
      </DataTableSheetDetails>
    </DataTableProvider>
  );
}

function Row<TData>({
  row,
  table,
  selected,
  visibleColumnIds,
  columnOrder,
}: {
  row: Row<TData>;
  table: TTable<TData>;
  selected?: boolean;
  visibleColumnIds: string;
  columnOrder: string;
}) {
  const { useFilterState } = require("@/lib/store");
  useFilterState((s: Record<string, unknown>) => s.live);
  return (
    <TableRow
      id={row.id}
      tabIndex={0}
      data-state={selected && "selected"}
      onClick={() => row.toggleSelected()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          row.toggleSelected();
        }
      }}
      className={cn(
        "[&>:not(:last-child)]:border-r",
        "outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:bg-muted/50 focus-visible:outline data-[state=selected]:outline",
        table.options.meta?.getRowClassName?.(row),
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            "truncate border-b border-border",
            cell.column.columnDef.meta?.cellClassName,
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

const MemoizedRow = React.memo(
  Row,
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.selected === next.selected &&
    prev.visibleColumnIds === next.visibleColumnIds &&
    prev.columnOrder === next.columnOrder,
) as typeof Row;
```

**IMPORTANT — Fix the `useFilterState` import in `Row`:** The `require()` call above is a placeholder. Replace it with a proper top-level import. The Row component uses `useFilterState` from `@/lib/store`. Add this at the top of the file alongside other imports:

```typescript
import { useFilterState } from "@/lib/store";
```

And replace the Row component's first line with just:
```typescript
useFilterState((s: Record<string, unknown>) => s.live);
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 6: Update `src/app/default/client.tsx` and `page.tsx`

**Files:**
- Modify: `src/app/default/client.tsx`
- Modify: `src/app/default/page.tsx`
- Delete: `src/app/default/data-table.tsx` (replaced by component)

**Step 1: Rewrite `src/app/default/client.tsx`**

```typescript
"use client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableStoreProvider } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { data } from "./data";
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

**Step 2: Simplify `src/app/default/page.tsx`**

```typescript
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
```

**Step 3: Delete `src/app/default/data-table.tsx`**

This file is no longer used. Delete it.

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 7: Update `src/app/tree/client.tsx` and `page.tsx`

**Files:**
- Modify: `src/app/tree/client.tsx`
- Modify: `src/app/tree/page.tsx`
- Delete: `src/app/tree/data-table.tsx`

**Step 1: Rewrite `src/app/tree/client.tsx`**

```typescript
"use client";

import { DataTableTree } from "@/components/data-table/data-table-tree";
import { DataTableStoreProvider } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { treeData } from "./data";
import { filterSchema } from "./schema";

export function Client() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "tree" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTableTree
        columns={columns}
        data={treeData}
        filterFields={filterFields}
        schema={filterSchema.definition}
        tableId="tree"
      />
    </DataTableStoreProvider>
  );
}
```

**Step 2: Simplify `src/app/tree/page.tsx`**

```typescript
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
```

**Step 3: Delete `src/app/tree/data-table.tsx`**

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 8: Update `src/app/infinite/client.tsx` and `page.tsx`

**Files:**
- Modify: `src/app/infinite/client.tsx`
- Modify: `src/app/infinite/page.tsx`
- Delete: `src/app/infinite/data-table-infinite.tsx`

**Context:** The infinite client is more complex. `ClientInner` stays (it needs the BYOS hooks inside the provider). We drop the Zustand branch and the `defaultAdapterType` prop. `DataTableInfinite` now takes `renderChart` and `renderActions` instead of rendering them internally.

**Step 1: Rewrite `src/app/infinite/client.tsx`**

```typescript
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
```

**Step 2: Simplify `src/app/infinite/page.tsx`**

Remove `defaultAdapterType` (no longer needed — always nuqs). Keep all prefetch logic intact. Only change: remove `ADAPTER_COOKIE_NAME` and `adapterType` variable, remove `defaultAdapterType` from `<Client>` calls:

```typescript
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
```

**Step 3: Delete `src/app/infinite/data-table-infinite.tsx`**

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 9: Update `registry.json`

**Files:**
- Modify: `registry.json` (at project root)

**Context:** Must now point only to `src/components/data-table/` and `src/lib/store/`. No route files. Three blocks: `data-table` (base), `data-table-infinite`, `data-table-tree`.

**Step 1: Overwrite `registry.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "data-table-filters",
  "items": [
    {
      "name": "data-table",
      "type": "registry:block",
      "title": "Data Table with Filters",
      "description": "Generic data table with filtering (input, checkbox, slider, timerange), sorting, pagination, column visibility, command palette, and nuqs URL state management.",
      "dependencies": [
        "@tanstack/react-table",
        "@tanstack/react-query",
        "nuqs",
        "date-fns",
        "cmdk",
        "lucide-react"
      ],
      "registryDependencies": [
        "table",
        "badge",
        "button",
        "checkbox",
        "accordion",
        "command",
        "popover",
        "slider",
        "calendar",
        "input",
        "separator",
        "sheet",
        "skeleton",
        "tooltip",
        "dropdown-menu"
      ],
      "files": [
        { "path": "src/components/data-table/data-table.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-provider.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-toolbar.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-pagination.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-controls.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-controls-drawer.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-command/index.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-command/utils.ts", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-checkbox.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-input.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-slider.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-timerange.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-filter-reset-button.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-reset-button.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-column-header.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-skeleton.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-view-options.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-store-sync.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-refresh-button.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-sheet/data-table-sheet-content.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-sheet/data-table-sheet-details.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-sheet/data-table-sheet-row-action.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-sheet/data-table-sheet-skeleton.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-cell/index.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-cell/data-table-cell-badge.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-cell/data-table-cell-boolean.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-cell/data-table-cell-code.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-cell/data-table-cell-number.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-cell/data-table-cell-text.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/data-table-cell/data-table-cell-timestamp.tsx", "type": "registry:component" },
        { "path": "src/components/data-table/types.ts", "type": "registry:component" },
        { "path": "src/components/data-table/utils.ts", "type": "registry:component" },
        { "path": "src/lib/store/index.ts", "type": "registry:lib" },
        { "path": "src/lib/store/schema/field.ts", "type": "registry:lib" },
        { "path": "src/lib/store/schema/index.ts", "type": "registry:lib" },
        { "path": "src/lib/store/schema/serialization.ts", "type": "registry:lib" },
        { "path": "src/lib/store/schema/types.ts", "type": "registry:lib" },
        { "path": "src/lib/store/adapters/nuqs/index.ts", "type": "registry:lib" },
        { "path": "src/lib/store/provider/DataTableStoreProvider.tsx", "type": "registry:lib" },
        { "path": "src/lib/store/hooks/useFilterState.ts", "type": "registry:lib" },
        { "path": "src/lib/store/hooks/useFilterActions.ts", "type": "registry:lib" },
        { "path": "src/lib/is-array.ts", "type": "registry:lib" }
      ]
    },
    {
      "name": "data-table-infinite",
      "type": "registry:block",
      "title": "Data Table Infinite Scroll",
      "description": "Infinite scroll variant of Data Table. Adds row selection, column reordering, column resizing, sheet detail panel, chart slot, live mode, and virtual scroll. Requires data-table.",
      "registryDependencies": ["data-table"],
      "files": [
        { "path": "src/components/data-table/data-table-infinite.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "data-table-tree",
      "type": "registry:block",
      "title": "Data Table Tree View",
      "description": "Tree/hierarchical data variant of Data Table. Adds inline expand/collapse with depth-based indentation, ancestor-preserving filters (filterFromLeafRows), and optional infinite scroll support. Requires data-table.",
      "registryDependencies": ["data-table"],
      "files": [
        { "path": "src/components/data-table/data-table-tree.tsx", "type": "registry:component" }
      ]
    }
  ]
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 10: Full TypeScript check and build verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors

**Step 2: Run build**

Run: `npm run build`
Expected: `✓ Compiled successfully` with `/default`, `/tree`, `/infinite` routes shown

**Step 3: Run tests**

Run: `npm test`
Expected: all tests pass (73/73)

**Step 4: Confirm deleted files are gone**

Verify these no longer exist:
- `src/app/default/data-table.tsx`
- `src/app/tree/data-table.tsx`
- `src/app/infinite/data-table-infinite.tsx`

**Step 5: Confirm new files exist**

Verify these exist:
- `src/components/data-table/data-table.tsx`
- `src/components/data-table/data-table-tree.tsx`
- `src/components/data-table/data-table-infinite.tsx`
- `src/components/data-table/data-table-refresh-button.tsx`
