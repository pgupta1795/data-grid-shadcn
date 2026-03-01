# Tree Data Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/tree` route to the data-table-filters project that renders hierarchical PLM component data from `ChildrenData.json` using TanStack Table v8's native sub-row system, with all existing filter types (input, checkbox, slider, timerange), command palette, column visibility, sorting, and pagination working correctly.

**Architecture:** New Next.js route at `src/app/tree/` using TanStack's `getSubRows: (row) => row.children`, `getExpandedRowModel()`, and `filterFromLeafRows: true`. The BYOS adapter system (nuqs + zustand) is reused unchanged. All existing UI components (`DataTableFilterControls`, `DataTableFilterCommand`, `DataTableToolbar`, `DataTablePagination`) work without modification — they consume the `DataTableProvider` context which is populated as normal. A `registry.json` at the project root exports the components for `npx shadcn add`.

**Tech Stack:** Next.js 16, React 19, TanStack Table v8 (`getSubRows`, `getExpandedRowModel`, `filterFromLeafRows`), nuqs v2, Zustand v5, shadcn/ui, Tailwind CSS, TypeScript. Key files to learn from: `src/app/default/data-table.tsx`, `src/app/default/columns.tsx`, `src/app/default/schema.ts`, `src/app/default/client.tsx`.

---

## Prerequisites

- `resolveJsonModule: true` is already in `tsconfig.json` ✓
- `ChildrenData.json` is at the project root ✓
- All filter UI components exist in `src/components/data-table/` ✓
- BYOS store system is complete in `src/lib/store/` ✓

---

### Task 1: Types

**Files:**
- Create: `src/app/tree/types.ts`

**Step 1: Create TypeScript types for the tree nodes**

These match the `ChildrenData.json` structure exactly. Dates will be `Date` objects after transformation in `data.ts`.

```typescript
// src/app/tree/types.ts
export type VPMInstance = {
  id: string;
  name: string;
  type: "VPMInstance";
  created: Date;
  modified: Date;
  cestamp?: string;
};

export type TreeNode = {
  id: string;
  title: string;
  name: string;
  type: "VPMReference" | "VPMInstance";
  state: string;
  revision: string;
  organization: string;
  owner: string;
  created: Date;
  modified: Date;
  collabspace: string;
  description?: string;
  cestamp?: string;
  instances: VPMInstance[];
  children: TreeNode[];
};
```

**Step 2: Verify TypeScript accepts the file**

Run: `npx tsc --noEmit`
Expected: Exits with no errors (or only pre-existing errors unrelated to tree/)

---

### Task 2: Data Loader

**Files:**
- Create: `src/app/tree/data.ts`

**Step 1: Create the data transformer and helpers**

Reads `ChildrenData.json` from the project root (3 levels up from `src/app/tree/`), recursively converts ISO date strings to `Date` objects. Also exports `flattenTree` which is used in `constants.tsx` to pre-compute filter options.

The `ChildrenData.json` root is a single node object (not an array). We wrap it in `[...]` so TanStack Table receives `TreeNode[]`.

```typescript
// src/app/tree/data.ts
import rawData from "../../../ChildrenData.json";
import type { TreeNode, VPMInstance } from "./types";

function transformInstance(raw: Record<string, unknown>): VPMInstance {
  return {
    id: raw.id as string,
    name: raw.name as string,
    type: "VPMInstance",
    created: new Date(raw.created as string),
    modified: new Date(raw.modified as string),
    cestamp: raw.cestamp as string | undefined,
  };
}

function transformNode(raw: Record<string, unknown>): TreeNode {
  return {
    id: raw.id as string,
    title: raw.title as string,
    name: raw.name as string,
    type: raw.type as "VPMReference" | "VPMInstance",
    state: (raw.state as string) ?? "UNKNOWN",
    revision: (raw.revision as string) ?? "",
    organization: (raw.organization as string) ?? "",
    owner: (raw.owner as string) ?? "",
    created: new Date(raw.created as string),
    modified: new Date(raw.modified as string),
    collabspace: (raw.collabspace as string) ?? "",
    description: raw.description as string | undefined,
    cestamp: raw.cestamp as string | undefined,
    instances: ((raw.instances as unknown[]) ?? []).map((i) =>
      transformInstance(i as Record<string, unknown>),
    ),
    children: ((raw.children as unknown[]) ?? []).map((c) =>
      transformNode(c as Record<string, unknown>),
    ),
  };
}

// Root is a single node — wrap in array so TanStack Table receives TreeNode[]
export const treeData: TreeNode[] = [
  transformNode(rawData as Record<string, unknown>),
];

// Flatten entire tree into a flat array — used to build filter options
export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

---

### Task 3: Filter Schema

**Files:**
- Create: `src/app/tree/schema.ts`

**Step 1: Create BYOS filter schema for tree fields**

Pattern: identical to `src/app/default/schema.ts`. Each field corresponds to a column in the table.

- `field.string()` → text input filter (title, name)
- `field.array(field.string()).delimiter(",")` → checkbox multi-select (state, type, revision, collabspace)
- `field.array(field.number()).delimiter("-")` → slider range (instancesCount)
- `field.array(field.timestamp()).delimiter("-")` → date range (modified)
- `field.sort()` → column sort state

```typescript
// src/app/tree/schema.ts
import { createSchema, field } from "@/lib/store/schema";

export const filterSchema = createSchema({
  // Text input filters
  title: field.string(),
  name: field.string(),

  // Checkbox filters — multi-select arrays of string
  state: field.array(field.string()).delimiter(","),
  type: field.array(field.string()).delimiter(","),
  revision: field.array(field.string()).delimiter(","),
  collabspace: field.array(field.string()).delimiter(","),

  // Slider filter — numeric range [min, max]
  instancesCount: field.array(field.number()).delimiter("-"),

  // Date range filter — [start, end] timestamps
  modified: field.array(field.timestamp()).delimiter("-"),

  // Sort state
  sort: field.sort(),
});

export type FilterState = typeof filterSchema._type;
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

---

### Task 4: Zustand Store

**Files:**
- Create: `src/app/tree/store.ts`

**Step 1: Create Zustand store for the tree filter state**

Pattern: identical to `src/app/default/store.ts`. Only change is `tableId = "tree"` to namespace the slice keys.

```typescript
// src/app/tree/store.ts
"use client";

import { createFilterSlice } from "@/lib/store/adapters/zustand";
import { create } from "zustand";
import { filterSchema } from "./schema";

export const useFilterStore = create<Record<string, unknown>>((set, get) => ({
  ...createFilterSlice(filterSchema.definition, "tree", set, get),
}));
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

---

### Task 5: Filter Constants

**Files:**
- Create: `src/app/tree/constants.tsx`

**Step 1: Create filterFields array with all filter types**

Uses `flattenTree` to pre-compute all unique values from the data at module load time. This drives the options shown in checkboxes and input autocomplete.

Filter types used (mirroring default + infinite routes):
- `"timerange"` → modified date (from `default` date field)
- `"input"` → title, name (from `default` name/url fields)
- `"checkbox"` → state, type, revision, collabspace (from `default` regions/tags fields)
- `"slider"` → instancesCount (from `default` p95 field)

```typescript
// src/app/tree/constants.tsx
"use client";

import type { DataTableFilterField } from "@/components/data-table/types";
import { flattenTree, treeData } from "./data";
import type { TreeNode } from "./types";

// Pre-compute unique filter option values from the full tree at module load
const allNodes = flattenTree(treeData);

const uniqueStates = [...new Set(allNodes.map((n) => n.state))].filter(Boolean);
const uniqueTypes = [...new Set(allNodes.map((n) => n.type))].filter(Boolean);
const uniqueRevisions = [...new Set(allNodes.map((n) => n.revision))].filter(Boolean);
const uniqueCollabspaces = [...new Set(allNodes.map((n) => n.collabspace))].filter(Boolean);

const instanceCounts = allNodes.map((n) => n.instances.length);
const maxInstancesCount = Math.max(...instanceCounts, 0);

export const filterFields = [
  {
    label: "Modified",
    value: "modified",
    type: "timerange",
    defaultOpen: true,
    commandDisabled: true,
  },
  {
    label: "Title",
    value: "title",
    type: "input",
    options: allNodes.map(({ title }) => ({ label: title, value: title })),
  },
  {
    label: "Name",
    value: "name",
    type: "input",
    options: allNodes.map(({ name }) => ({ label: name, value: name })),
  },
  {
    label: "State",
    value: "state",
    type: "checkbox",
    defaultOpen: true,
    options: uniqueStates.map((s) => ({ label: s, value: s })),
  },
  {
    label: "Type",
    value: "type",
    type: "checkbox",
    options: uniqueTypes.map((t) => ({ label: t, value: t })),
  },
  {
    label: "Revision",
    value: "revision",
    type: "checkbox",
    options: uniqueRevisions.map((r) => ({ label: r, value: r })),
  },
  {
    label: "Collabspace",
    value: "collabspace",
    type: "checkbox",
    options: uniqueCollabspaces.map((c) => ({ label: c, value: c })),
  },
  {
    label: "Instances",
    value: "instancesCount",
    type: "slider",
    min: 0,
    max: maxInstancesCount,
    options: instanceCounts.map((count) => ({
      label: `${count}`,
      value: count,
    })),
    defaultOpen: true,
  },
] satisfies DataTableFilterField<TreeNode>[];
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

---

### Task 6: Columns

**Files:**
- Create: `src/app/tree/columns.tsx`

**Step 1: Create column definitions with expand/collapse UX and filter functions**

Key points:
- **Title column**: inline expand toggle (`row.getToggleExpandedHandler()`), depth-based left padding (`row.depth * 16`px), `enableHiding: false`
- **instancesCount**: uses `accessorFn` (computed, not a direct field on `TreeNode`)
- **filterFn patterns**: copied from `src/app/default/columns.tsx` — string match for input, `value.includes(rowValue)` for checkbox, numeric range for slider, date range for timerange
- `filterFromLeafRows: true` in the table config (Task 7) handles ancestor preservation — these `filterFn`s only need to check the current row's own value

```typescript
// src/app/tree/columns.tsx
"use client";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { isArrayOfDates, isArrayOfNumbers } from "@/lib/is-array";
import type { ColumnDef } from "@tanstack/react-table";
import { format, isSameDay } from "date-fns";
import { ChevronDown, ChevronRight, Minus } from "lucide-react";
import type { TreeNode } from "./types";

export const columns: ColumnDef<TreeNode>[] = [
  {
    accessorKey: "title",
    header: "Title",
    enableHiding: false,
    cell: ({ row }) => {
      const canExpand = row.getCanExpand();
      const isExpanded = row.getIsExpanded();
      return (
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${row.depth * 16}px` }}
        >
          {canExpand ? (
            <button
              onClick={row.getToggleExpandedHandler()}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{row.getValue("title")}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (typeof value === "string")
        return rowValue.toLowerCase().includes(value.toLowerCase());
      return false;
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (typeof value === "string")
        return rowValue.toLowerCase().includes(value.toLowerCase());
      return false;
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const value = row.getValue("type") as string;
      return (
        <Badge variant="outline" className="font-mono text-xs">
          {value}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => {
      const value = row.getValue("state") as string;
      const variant =
        value === "IN_WORK"
          ? "secondary"
          : value === "FROZEN"
            ? "default"
            : "outline";
      return <Badge variant={variant}>{value}</Badge>;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    accessorKey: "revision",
    header: "Revision",
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    accessorKey: "organization",
    header: "Organization",
  },
  {
    accessorKey: "collabspace",
    header: "Collabspace",
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    id: "instancesCount",
    accessorFn: (row) => row.instances.length,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Instances" />
    ),
    cell: ({ row }) => {
      const count = row.getValue("instancesCount") as number;
      if (count === 0)
        return <Minus className="h-4 w-4 text-muted-foreground/50" />;
      return <span className="font-mono">{count}</span>;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as number;
      if (typeof value === "number") return value === rowValue;
      if (Array.isArray(value) && isArrayOfNumbers(value)) {
        if (value.length === 1) return value[0] === rowValue;
        const sorted = [...value].sort((a, b) => a - b);
        return sorted[0] <= rowValue && rowValue <= sorted[1];
      }
      return false;
    },
  },
  {
    accessorKey: "modified",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Modified" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("modified");
      return (
        <div className="text-xs text-muted-foreground" suppressHydrationWarning>
          {format(new Date(`${value}`), "LLL dd, y HH:mm")}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id);
      if (value instanceof Date && rowValue instanceof Date) {
        return isSameDay(value, rowValue);
      }
      if (Array.isArray(value)) {
        if (isArrayOfDates(value) && rowValue instanceof Date) {
          const sorted = [...value].sort((a, b) => a.getTime() - b.getTime());
          return (
            sorted[0]?.getTime() <= rowValue.getTime() &&
            rowValue.getTime() <= sorted[1]?.getTime()
          );
        }
      }
      return false;
    },
  },
];
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

---

### Task 7: DataTable Component

**Files:**
- Create: `src/app/tree/data-table.tsx`

**Step 1: Create the DataTable component with tree row models**

Pattern: based on `src/app/default/data-table.tsx`. Additions vs default:
1. Import `getExpandedRowModel`, `ExpandedState` from `@tanstack/react-table`
2. Add `expanded` state with `React.useState<ExpandedState>({})`
3. Pass `expanded` in `state` and `onExpandedChange` to `useReactTable`
4. Add `getSubRows: (row) => row.children` — tells TanStack where children are
5. Add `getExpandedRowModel: getExpandedRowModel()` — enables expand/collapse
6. Add `filterFromLeafRows: true` — keeps ancestor rows visible when a descendant matches

Everything else (layout, `DataTableProvider`, row rendering, `customGetFacetedUniqueValues`) is identical to the default route.

```typescript
// src/app/tree/data-table.tsx
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
import type { DataTableFilterField } from "@/components/data-table/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getColumnVisibilityKey } from "@/lib/constants/local-storage";
import { cn } from "@/lib/utils";
import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  SortingState,
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
import * as React from "react";
import { filterSchema } from "./schema";
import type { TreeNode } from "./types";

export interface DataTableProps {
  columns: ColumnDef<TreeNode>[];
  data: TreeNode[];
  defaultColumnFilters?: ColumnFiltersState;
  filterFields?: DataTableFilterField<TreeNode>[];
  tableId?: string;
}

export function DataTable({
  columns,
  data,
  defaultColumnFilters = [],
  filterFields = [],
  tableId = "tree",
}: DataTableProps) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>(getColumnVisibilityKey(tableId), {});

  // Reset pagination to page 0 when filters change
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  // Custom getFacetedUniqueValues that handles array values
  // (same implementation as default/data-table.tsx)
  const customGetFacetedUniqueValues = React.useCallback(
    (table: TTable<TreeNode>, columnId: string) => () => {
      const facets = getFacetedUniqueValues<TreeNode>()(table, columnId)();
      const customFacets = new Map();
      for (const [key, value] of facets as Map<unknown, number>) {
        if (Array.isArray(key)) {
          for (const k of key) {
            const prevValue = customFacets.get(k) || 0;
            customFacets.set(k, prevValue + value);
          }
        } else {
          const prevValue = customFacets.get(key) || 0;
          customFacets.set(key, prevValue + value);
        }
      }
      return customFacets;
    },
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
      expanded,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    // ── Tree-specific options ──────────────────────────────────────────────
    // Tell TanStack where to find each row's children
    getSubRows: (row) => row.children,
    // Keep ancestor rows visible when any descendant matches a filter
    filterFromLeafRows: true,
    // Enable the expand/collapse row model
    getExpandedRowModel: getExpandedRowModel(),
    // ── Standard row models (unchanged from default route) ─────────────────
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

  // Wrap signature for DataTableProvider (needs Map<string,number>, not function)
  const getFacetedUniqueValuesForProvider = React.useCallback(
    (table: TTable<TreeNode>, columnId: string): Map<string, number> => {
      return customGetFacetedUniqueValues(table, columnId)();
    },
    [customGetFacetedUniqueValues],
  );

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      pagination={pagination}
      getFacetedUniqueValues={getFacetedUniqueValuesForProvider}
    >
      <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "hidden w-full p-1 sm:block sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-64 md:max-w-64",
            "group-data-[expanded=false]/controls:hidden",
          )}
        >
          <DataTableFilterControls />
        </div>
        <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
          <DataTableFilterCommand
            schema={filterSchema.definition}
            tableId="tree"
          />
          <DataTableToolbar />
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

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

---

### Task 8: Client Component

**Files:**
- Create: `src/app/tree/client.tsx`

**Step 1: Create client with nuqs + zustand adapters**

Pattern: identical to `src/app/default/client.tsx`. The Client component reads `defaultAdapterType` from a cookie (passed from server in page.tsx) and renders either the nuqs or zustand variant. Data is imported directly from `./data` (not passed as prop, since it's static JSON).

```typescript
// src/app/tree/client.tsx
"use client";

import { DataTableStoreProvider, type AdapterType } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useZustandAdapter } from "@/lib/store/adapters/zustand";
import * as React from "react";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { DataTable } from "./data-table";
import { treeData } from "./data";
import { filterSchema } from "./schema";
import { useFilterStore } from "./store";

interface ClientProps {
  defaultAdapterType?: AdapterType;
}

export function Client({ defaultAdapterType = "nuqs" }: ClientProps) {
  return (
    <React.Fragment>
      {defaultAdapterType === "nuqs" ? <NuqsClient /> : <ZustandClient />}
    </React.Fragment>
  );
}

function NuqsClient() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "tree" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable columns={columns} data={treeData} filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}

function ZustandClient() {
  const adapter = useZustandAdapter(useFilterStore, filterSchema.definition, {
    id: "tree",
  });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable columns={columns} data={treeData} filterFields={filterFields} />
    </DataTableStoreProvider>
  );
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No new errors

---

### Task 9: Page, Layout, Skeleton

**Files:**
- Create: `src/app/tree/page.tsx`
- Create: `src/app/tree/layout.tsx`
- Create: `src/app/tree/skeleton.tsx`

**Step 1: Create layout (identical to `src/app/default/layout.tsx`)**

```typescript
// src/app/tree/layout.tsx
import { SocialsFooter } from "@/components/layout/socials-footer";
import * as React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container mx-auto flex min-h-screen flex-col gap-4 p-4 sm:p-8">
      <div className="relative mx-auto flex h-full min-h-full w-full max-w-7xl flex-col gap-4 rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-[2px] sm:gap-8 sm:p-8">
        {children}
      </div>
      <SocialsFooter />
    </main>
  );
}
```

**Step 2: Create skeleton (adapted from `src/app/default/skeleton.tsx`)**

```typescript
// src/app/tree/skeleton.tsx
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { Skeleton as DefaultSkeleton } from "@/components/ui/skeleton";

export function Skeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
      <div className="w-full p-1 sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-64 md:max-w-64">
        <div className="-m-1 h-full p-1">
          <div className="flex flex-col gap-4">
            <div className="flex h-11 w-full items-center">
              <DefaultSkeleton className="h-6 w-12" />
            </div>
            <div className="grid gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <DefaultSkeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex max-w-full flex-1 flex-col gap-4 p-1">
        <DefaultSkeleton className="h-11 w-full border border-border" />
        <div className="flex h-9 items-center justify-between">
          <DefaultSkeleton className="h-full w-full max-w-36" />
          <DefaultSkeleton className="h-full w-full max-w-20" />
        </div>
        <div className="rounded-md border">
          <DataTableSkeleton />
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create page server component (reads adapter cookie)**

Pattern: identical to `src/app/default/page.tsx`. Reads the `ADAPTER_COOKIE_NAME` cookie to choose between nuqs and zustand adapters.

```typescript
// src/app/tree/page.tsx
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
```

**Step 4: Start dev server and verify the route loads**

Run: `npm run dev`
Visit: `http://localhost:3000/tree`

Expected:
- Table renders with one root row: "Electric Drive" with a `▶` chevron
- Clicking chevron expands to show children ("EI_001120_Motor 170", etc.)
- Filter sidebar visible with: Modified (timerange), Title (input), Name (input), State (checkbox), Type (checkbox), Revision (checkbox), Collabspace (checkbox), Instances (slider)
- Pagination shows at bottom

---

### Task 10: Add Tree Route to Home Navigation

**Files:**
- Modify: `src/app/(home)/page.tsx`

**Step 1: Add tree route link to the Examples section**

Read `src/app/(home)/page.tsx` (already done — the `Examples` function at line 444 has a list of "More Examples" links). Add the tree route as a new `<li>` entry.

Find this block:
```tsx
function Examples() {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">More Examples</p>
      <ul
        role="list"
        className="grid list-inside list-disc gap-2 marker:text-muted-foreground"
      >
        <li>
          <Link href="/light">OpenStatus Light Viewer</Link>
        </li>
      </ul>
    </div>
  );
}
```

Replace with:
```tsx
function Examples() {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">More Examples</p>
      <ul
        role="list"
        className="grid list-inside list-disc gap-2 marker:text-muted-foreground"
      >
        <li>
          <Link href="/light">OpenStatus Light Viewer</Link>
        </li>
        <li>
          <Link href="/tree">Tree Data Table</Link>
        </li>
      </ul>
    </div>
  );
}
```

**Step 2: Verify navigation**

Visit `http://localhost:3000` and confirm "Tree Data Table" link appears in the More Examples section.

---

### Task 11: Registry

**Files:**
- Create: `registry.json` at project root (`C:\UK VM\Issues\widgets\templates\data-table-filters\registry.json`)

**Step 1: Check exact dependency names in package.json**

Run: `cat package.json | grep -E '"@tanstack|"nuqs|"zustand|"date-fns|"cmdk|"lucide'`

Use the exact package names found (without version numbers) for the `dependencies` array.

**Step 2: Create registry.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "data-table-filters",
  "items": [
    {
      "name": "data-table",
      "type": "registry:block",
      "title": "Data Table with Filters",
      "description": "Advanced data table with filtering (input, checkbox, slider, timerange), sorting, pagination, column visibility, command palette, and BYOS state management (nuqs URL state or Zustand client state).",
      "dependencies": [
        "@tanstack/react-table",
        "@tanstack/react-query",
        "nuqs",
        "zustand",
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
        {
          "path": "src/components/data-table/data-table-provider.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-toolbar.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-pagination.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-filter-controls.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-filter-command/index.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-filter-command/utils.ts",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-view-options.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-column-header.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-skeleton.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-filter-checkbox.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-filter-input.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-filter-slider.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-filter-timerange.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/data-table-reset-button.tsx",
          "type": "registry:component"
        },
        {
          "path": "src/components/data-table/types.ts",
          "type": "registry:component"
        },
        {
          "path": "src/lib/store/index.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/schema/field.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/schema/index.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/schema/serialization.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/schema/types.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/adapters/nuqs/index.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/adapters/zustand/index.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/adapters/zustand/slice.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/provider/DataTableStoreProvider.tsx",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/hooks/useFilterState.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/store/hooks/useFilterActions.ts",
          "type": "registry:lib"
        },
        {
          "path": "src/lib/is-array.ts",
          "type": "registry:lib"
        }
      ]
    },
    {
      "name": "data-table-tree",
      "type": "registry:block",
      "title": "Data Table Tree View",
      "description": "Tree/hierarchical data support for Data Table. Inline expand/collapse with depth-based indentation, ancestor-preserving filters (filterFromLeafRows), all filter types (input, checkbox, slider, timerange), sorting, pagination of visible rows.",
      "registryDependencies": ["data-table"],
      "files": [
        {
          "path": "src/app/tree/types.ts",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/data.ts",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/schema.ts",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/store.ts",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/constants.tsx",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/columns.tsx",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/data-table.tsx",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/client.tsx",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/page.tsx",
          "type": "registry:example"
        },
        {
          "path": "src/app/tree/layout.tsx",
          "type": "registry:example"
        }
      ]
    }
  ]
}
```

**Step 3: Validate it is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('registry.json','utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

---

### Task 12: Final Build Verification

**Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 2: Run production build**

Run: `npm run build`
Expected: Build completes successfully with no errors

**Step 3: Manual smoke test checklist**

Start dev server (`npm run dev`) and visit `http://localhost:3000/tree`. Verify:

- [ ] Root row "Electric Drive" renders with `▶` chevron
- [ ] Clicking chevron expands to show children (indented one level)
- [ ] Multi-level nesting works (expanding children of children shows grandchildren)
- [ ] Leaf nodes show a spacer (no chevron) in the Title column
- [ ] **Title filter**: type "Motor" → rows matching "Motor" remain visible WITH parent "Electric Drive"
- [ ] **State checkbox**: select "IN_WORK" → matching rows visible, all their ancestors preserved
- [ ] **Type checkbox**: select "VPMReference" → works
- [ ] **Revision checkbox**: select "A" → works
- [ ] **Collabspace checkbox**: select a value → works
- [ ] **Instances slider**: drag range → rows with matching instance count visible
- [ ] **Modified timerange**: pick a date range → works
- [ ] Resetting filters (X button) clears all filters and shows full tree
- [ ] Column visibility: hiding "Organization" removes that column
- [ ] Sorting: clicking "Modified" header sorts rows
- [ ] Pagination: page navigation works, expanding rows increases visible row count
- [ ] Command palette (Cmd+K or ⌘B) opens and shows filter suggestions
- [ ] URL state: filters appear in URL bar when nuqs adapter active
- [ ] Home page has "Tree Data Table" link in More Examples section

---

## Notes for Implementer

**TanStack Tree Key Facts:**
- `getSubRows` is the only required addition to enable tree rows
- `filterFromLeafRows: true` is what makes filters "bubble up" to ancestors — without it, filtering would hide parent rows even if children match
- `getExpandedRowModel()` must be called (returns a factory) and passed to `getExpandedRowModel:` in `useReactTable`
- `expanded` state uses `ExpandedState` type from `@tanstack/react-table` (it's `Record<string, boolean>`)
- `row.depth` starts at 0 for root rows, increments for each nesting level
- `row.getCanExpand()` returns `true` when `getSubRows` returns a non-empty array for that row
- Pagination with `getPaginationRowModel()` counts expanded visible rows only — no special config needed

**Common Pitfalls:**
- The `filterFn` on each column only needs to check the current row's value — do NOT implement recursive logic in filterFns, `filterFromLeafRows` handles that automatically
- `"use no memo"` directive is required at the top of the data-table.tsx file due to React Compiler + TanStack Table v8 incompatibility
- `accessorFn` (not `accessorKey`) is needed for the `instancesCount` column since it's computed from `row.instances.length`
- The JSON import path is `"../../../ChildrenData.json"` from `src/app/tree/data.ts` (3 directories up from tree → app → src → project root)
