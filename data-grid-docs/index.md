# Data Grid Documentation

A fully-featured, composable data-grid system built on [TanStack Table](https://tanstack.com/table/latest), [shadcn/ui](https://ui.shadcn.com), and React. Installable via the **shadcn registry** with a single command.

## Installation

```bash
npx shadcn@latest add https://raw.githubusercontent.com/pgupta1795/data-grid-shadcn/main/public/r/data-table.json
```

This installs all variants (Standard, Infinite Scroll, Tree) into `components/data-grid/` with the store layer at `lib/data-grid/`.

---

## Table of Contents

### Core References

| Document                                              | Description                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Getting Started](./01-getting-started.md)            | Installation, prerequisites, and your first table                                                                  |
| [Table Variants](./02-table-variants.md)              | `DataTable`, `DataTableInfinite`, `DataTableTree` — props, layout, and when to use each                            |
| [Table Schema System](./03-table-schema.md)           | Declarative `col.*` builders, `createTableSchema`, `InferTableType`, presets, and JSON serialization               |
| [Columns Configuration](./04-columns.md)              | `generateColumns`, manual `ColumnDef`, cell renderers, column header, and `getDefaultColumnVisibility`             |
| [Filtering](./05-filtering.md)                        | Filter field types, `generateFilterFields`, `DataTableFilterControls`, command palette, and `generateFilterSchema` |
| [Sheet / Detail Panel](./06-sheet.md)                 | `generateSheetFields`, `SheetField` config, row detail drawer, and custom renderers                                |
| [Sorting & Pagination](./07-sorting-pagination.md)    | Click-to-sort headers, `DataTablePagination`, infinite scroll mechanics                                            |
| [Toolbar & View Options](./08-toolbar.md)             | `DataTableToolbar`, column visibility, drag-and-drop ordering, render slots                                        |
| [State Management (BYOS)](./09-state-management.md)   | `DataTableStoreProvider`, adapters (nuqs / Zustand), filter schema, store hooks, and `DataTableStoreSync`          |
| [Loading & Skeleton States](./10-loading-skeleton.md) | `isLoading`, `isFetching`, `DataTableSkeleton`, skeleton shimmer for filters and sheet                             |
| [Hooks Reference](./11-hooks.md)                      | `useDataTable`, `useFilterState`, `useFilterActions`, `useFilterField`, `useHotKey`, and utility hooks             |
| [Types Reference](./12-types.md)                      | All exported TypeScript types, interfaces, and generics                                                            |

### Examples

| Example                                                                 | Description                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Example 1: Default Data Table](./examples/example-default.md)          | Client-side pagination with static data                           |
| [Example 2: Infinite Scroll Data Table](./examples/example-infinite.md) | Server-side filtering with `useInfiniteQuery` and URL state       |
| [Example 3: Tree Data Table](./examples/example-tree.md)                | Hierarchical data with expand/collapse, pagination, and filtering |

---

## Tech Stack

| Library                 | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `@tanstack/react-table` | Core table engine (sorting, filtering, pagination, row models) |
| `@tanstack/react-query` | Server-state for infinite scroll and data fetching             |
| `shadcn/ui`             | UI primitives (Table, Button, Checkbox, Sheet, etc.)           |
| `nuqs`                  | URL query-string state management                              |
| `cmdk`                  | Command palette for filter search                              |
| `@dnd-kit`              | Drag-and-drop column reordering                                |
| `date-fns`              | Date formatting                                                |
| `lucide-react`          | Icons                                                          |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Your Page / Route                   │
│  ┌───────────────────────────────────────────────┐  │
│  │         DataTableStoreProvider (BYOS)          │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │   DataTable / Infinite / Tree Variant    │  │  │
│  │  │  ┌───────────────────────────────────┐  │  │  │
│  │  │  │      DataTableProvider (Context)   │  │  │  │
│  │  │  │  ┌─────────┐  ┌──────────────┐   │  │  │  │
│  │  │  │  │ Toolbar  │  │ FilterControls│  │  │  │  │
│  │  │  │  │ Pagination│ │ FilterCommand │  │  │  │  │
│  │  │  │  │ ViewOpts  │ │ SheetDetails  │  │  │  │  │
│  │  │  │  └─────────┘  └──────────────┘   │  │  │  │
│  │  │  └───────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start (5 minutes)

```tsx
import { DataTable } from "@/components/data-grid/data-table";
import { DataTableStoreProvider } from "@/lib/data-grid/store";
import { useNuqsAdapter } from "@/lib/data-grid/store/adapters/nuqs";
import { createSchema, field } from "@/lib/data-grid/store/schema/schema";
import {
  col,
  createTableSchema,
  generateColumns,
  generateFilterFields,
  getDefaultColumnVisibility,
} from "@/lib/data-grid/table-schema";

// 1. Define your table schema
const tableSchema = createTableSchema({
  name: col.string().label("Name").size(200),
  email: col.string().label("Email"),
  role: col
    .enum(["admin", "user", "viewer"] as const)
    .label("Role")
    .defaultOpen(),
  active: col.boolean().label("Active"),
  createdAt: col.timestamp().label("Created").sortable(),
});

// 2. Generate everything from the schema
const columns = generateColumns(tableSchema.definition);
const filterFields = generateFilterFields(tableSchema.definition);
const defaultColumnVisibility = getDefaultColumnVisibility(
  tableSchema.definition,
);

// 3. Define your filter schema (for BYOS store)
const filterSchema = createSchema({
  name: field.string(),
  email: field.string(),
  role: field.array(field.stringLiteral(["admin", "user", "viewer"] as const)),
  active: field.array(field.boolean()).delimiter(","),
  createdAt: field.array(field.timestamp()).delimiter("-"),
});

// 4. Render
export function MyTable({ data }) {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "my-table" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable
        columns={columns}
        data={data}
        filterFields={filterFields}
        defaultColumnVisibility={defaultColumnVisibility}
        schema={filterSchema.definition}
        tableId="my-table"
      />
    </DataTableStoreProvider>
  );
}
```

> See the individual documentation files linked above for detailed explanations of every feature.
