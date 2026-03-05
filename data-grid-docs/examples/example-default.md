# Example 1: Default Data Table

A client-side paginated table with static data, checkbox/slider/input/timerange filters, and URL state via nuqs.

---

## What this example demonstrates

- ✅ Standard `DataTable` with client-side pagination
- ✅ Manually defined `ColumnDef[]` and `DataTableFilterField[]`
- ✅ BYOS with generic state adapter
- ✅ All filter types: `checkbox`, `slider`, `input`, `timerange`
- ✅ Custom filter option rendering
- ✅ Static dataset (no server queries)

---

## File Structure

```text
src/
├── App.tsx            # Entry component — renders DataTable
├── columns.tsx        # Manual ColumnDef[] definitions
├── constants.tsx      # filterFields configuration
├── data.ts            # Static data array
├── schema.ts          # BYOS filter schema
├── types.ts           # ColumnSchema type
├── store.ts           # Store export
└── skeleton.tsx       # Custom skeleton
```

---

## Step-by-Step

### 1. Define Your Data Type

```ts
// types.ts
export type ColumnSchema = {
  name: string;
  url: string;
  p95: number;
  public: boolean;
  active: boolean;
  regions: string[];
  tags: string[];
  date: Date;
};
```

### 2. Define the Filter Schema (BYOS)

```ts
// schema.ts
import { createSchema, field } from "@/lib/data-grid/store/schema/schema";

export const filterSchema = createSchema({
  url: field.string(),
  name: field.string(),
  p95: field.array(field.number()).delimiter("-"),
  public: field.array(field.boolean()).delimiter(","),
  active: field.array(field.boolean()).delimiter(","),
  regions: field.array(field.stringLiteral(REGIONS)).delimiter(","),
  tags: field.array(field.stringLiteral(TAGS)).delimiter(","),
  date: field.array(field.timestamp()).delimiter("-"),
});
```

### 3. Define Filter Fields

```tsx
// constants.tsx
import type { DataTableFilterField } from "@/components/data-grid/types";

export const filterFields = [
  {
    label: "Time Range",
    value: "date",
    type: "timerange",
    defaultOpen: true,
    commandDisabled: true,
  },
  {
    label: "Name",
    value: "name",
    type: "input",
    options: data.map(({ name }) => ({ label: name, value: name })),
  },
  {
    label: "P95",
    value: "p95",
    type: "slider",
    min: 0,
    max: 3000,
    options: data.map(({ p95 }) => ({ label: `${p95}`, value: p95 })),
    defaultOpen: true,
  },
  {
    label: "Regions",
    value: "regions",
    type: "checkbox",
    options: REGIONS.map((r) => ({ label: r, value: r })),
  },
  {
    label: "Tags",
    value: "tags",
    type: "checkbox",
    defaultOpen: true,
    component: (props) => (
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate font-normal">{props.value}</span>
        <span
          className={cn("h-2 w-2 rounded-full", tagColor[props.value].dot)}
        />
      </div>
    ),
    options: TAGS.map((tag) => ({ label: tag, value: tag })),
  },
] satisfies DataTableFilterField<ColumnSchema>[];
```

### 4. Define Columns (Manual)

```tsx
// columns.tsx
import { DataTableColumnHeader } from "@/components/data-grid/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";

export const columns: ColumnDef<ColumnSchema>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ getValue }) => <span>{getValue() as string}</span>,
    meta: { label: "Name" },
  },
  {
    accessorKey: "p95",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P95" />
    ),
    cell: ({ getValue }) => <>{getValue()}ms</>,
    filterFn: "inNumberRange",
    meta: { label: "P95" },
  },
  // ... more columns
];
```

### 5. Render the Table

```tsx
// App.tsx
import { DataTable } from "@/components/data-grid/data-table";
import { DataTableStoreProvider } from "@/lib/data-grid/store";
// Use your preferred adapter (e.g. React state, router, etc.)
import { useNuqsAdapter } from "@/lib/data-grid/store/adapters/nuqs";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { data } from "./data";
import { filterSchema } from "./schema";

export function App() {
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

---

## Key Takeaways

1. **Static data** — The entire dataset is passed as `data` prop. Filtering, sorting, and pagination are all client-side.
2. **Manual columns** — Columns are defined as `ColumnDef[]` with explicit `header`, `cell`, and `filterFn`.
3. **BYOS store** — `useNuqsAdapter` provides generic state sync automatically.
4. **Filter fields separate from columns** — `filterFields` is a standalone array describing the sidebar UI.
