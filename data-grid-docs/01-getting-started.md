# Getting Started

## Prerequisites

| Requirement | Version                      |
| ----------- | ---------------------------- |
| React       | 18+ or 19                    |
| Next.js     | 14+ (App Router recommended) |
| TypeScript  | 5+                           |
| shadcn/ui   | Initialized in your project  |

### Required shadcn/ui components

The registry installation auto-installs these dependencies:

```
command, input, slider, table, accordion, badge, tooltip, button,
dropdown-menu, sheet, skeleton, popover, checkbox, separator, calendar, drawer
```

### Required npm packages

```json
{
  "date-fns": "^3.x",
  "@tanstack/react-query": "^5.x",
  "@tanstack/react-table": "^8.x",
  "lucide-react": "^0.x",
  "nuqs": "^2.x",
  "cmdk": "^1.x"
}
```

---

## Installation

### Via shadcn Registry (Recommended)

```bash
npx shadcn@latest add https://raw.githubusercontent.com/pgupta1795/data-grid-shadcn/main/public/r/data-table.json
```

This places all files into:

```
your-project/
├── components/data-grid/          # All table components
│   ├── data-table.tsx             # Standard paginated table
│   ├── data-table-infinite.tsx    # Infinite scroll table
│   ├── data-table-tree.tsx        # Tree/hierarchical table
│   ├── data-table-provider.tsx    # React Context for shared state
│   ├── data-table-toolbar.tsx     # Toolbar with controls toggle, row count, actions
│   ├── data-table-pagination.tsx  # Page controls + rows-per-page selector
│   ├── data-table-skeleton.tsx    # Loading skeleton
│   ├── data-table-filter-controls.tsx
│   ├── data-table-filter-checkbox.tsx
│   ├── data-table-filter-slider.tsx
│   ├── data-table-filter-input.tsx
│   ├── data-table-filter-timerange.tsx
│   ├── data-table-filter-command/
│   ├── data-table-column-header.tsx
│   ├── data-table-view-options.tsx
│   ├── data-table-store-sync.tsx
│   ├── data-table-reset-button.tsx
│   ├── data-table-refresh-button.tsx
│   ├── data-table-sheet/
│   ├── data-table-cell/
│   ├── types.ts
│   └── utils.ts
├── lib/data-grid/
│   ├── store/                     # BYOS state management
│   │   ├── schema/                # Schema builder (field.*, createSchema)
│   │   ├── adapters/nuqs/         # nuqs URL state adapter
│   │   ├── hooks/                 # useFilterState, useFilterActions, etc.
│   │   └── provider/              # DataTableStoreProvider
│   ├── table-schema/              # Declarative col.* schema system
│   │   ├── col.ts                 # Column type factories
│   │   ├── presets.ts             # Pre-built column patterns
│   │   ├── generators/            # generateColumns, generateFilterFields, etc.
│   │   └── types.ts               # TypeScript types
│   ├── table/filterfns.ts         # Custom filter functions
│   └── format.ts                  # Number formatting utilities
└── hooks/
    ├── use-hot-key.ts
    ├── use-local-storage.ts
    ├── use-media-query.ts
    ├── use-debounce.ts
    └── use-copy-to-clipboard.ts
```

---

## Minimal Example

```tsx
"use client";

import { DataTable } from "@/components/data-grid/data-table";
import { DataTableStoreProvider } from "@/lib/data-grid/store";
import { useNuqsAdapter } from "@/lib/data-grid/store/adapters/nuqs";
import { createSchema, field } from "@/lib/data-grid/store/schema/schema";
import type { ColumnDef } from "@tanstack/react-table";

// 1. Define your data type
type User = { id: string; name: string; email: string };

// 2. Define columns manually (or use generateColumns — see Table Schema docs)
const columns: ColumnDef<User>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
];

// 3. Define filter schema for BYOS
const filterSchema = createSchema({
  name: field.string(),
  email: field.string(),
});

// 4. Sample data
const data: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

// 5. Render
export function UsersTable() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "users" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable
        columns={columns}
        data={data}
        schema={filterSchema.definition}
        tableId="users"
      />
    </DataTableStoreProvider>
  );
}
```

> **Next:** See [Table Variants](./02-table-variants.md) to choose between standard, infinite, and tree modes.
