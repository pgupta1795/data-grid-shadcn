# Columns Configuration

## `generateColumns(schema)`

Generates `ColumnDef<TData>[]` from a `TableSchemaDefinition`. This is the **recommended** approach — define your schema once, generate everything.

```ts
import { generateColumns } from "@/lib/data-grid/table-schema";

const columns = generateColumns<MyRow>(tableSchema.definition);
```

### What it does

For each entry in the schema:

1. **Header:** Sortable columns get a `<DataTableColumnHeader>` with sort controls; others get a plain string label.
2. **Cell:** Renders via built-in cell components based on the `display` config.
3. **Filter function:** Automatically derived:
   - `"input"` + string → `includesString`
   - `"input"` + number → `equals`
   - `"slider"` → `inNumberRange`
   - `"timerange"` → `inDateRange` (custom — must be registered)
   - `"checkbox"` + array → `arrIncludesSome`
   - `"checkbox"` + scalar → `arrSome` (custom — must be registered)
4. **Dotted keys:** `"timing.dns"` automatically uses `accessorFn` with an `id` instead of `accessorKey`.
5. **Size:** Sets both `size` and `minSize`.
6. **Meta:** Always includes `meta.label` and `meta.hidden`.

### Appending Custom Columns

Composite or virtual columns must be added manually:

```ts
const columns = [
  ...generateColumns<ColumnSchema>(tableSchema.definition),
  {
    id: "timing",
    header: "Timing Phases",
    cell: ({ row }) => <TimingBar timing={row.original} />,
    size: 130,
  },
];
```

---

## Built-in Cell Renderers

Located in `components/data-grid/data-table-cell/`:

| Component                | Display Type  | Renders                             |
| ------------------------ | ------------- | ----------------------------------- |
| `DataTableCellText`      | `"text"`      | Plain text with overflow tooltip    |
| `DataTableCellCode`      | `"code"`      | Monospace text                      |
| `DataTableCellNumber`    | `"number"`    | Formatted number with optional unit |
| `DataTableCellTimestamp` | `"timestamp"` | Relative time, absolute on hover    |
| `DataTableCellBadge`     | `"badge"`     | Colored chip                        |
| `DataTableCellBoolean`   | `"boolean"`   | Checkmark / dash icon               |

### Custom cell via `display("custom", { cell })`

```ts
col.number().display("custom", {
  cell: (value, row) => <LatencyBar value={value as number} />,
})
```

> **Note:** Custom cell functions are **not serializable** — they won't survive `toJSON()` / `fromJSON()`.

---

## `DataTableColumnHeader`

Renders a sortable column header with ascending/descending/none controls.

```tsx
import { DataTableColumnHeader } from "@/components/data-grid/data-table-column-header";

// Automatic when using .sortable() in schema
col.timestamp().label("Date").sortable()

// Manual in ColumnDef
{
  accessorKey: "date",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
}
```

The header supports:

- Click to cycle: none → ascending → descending → none
- Visual sort indicator arrows
- Accessible `aria-sort` attribute

---

## `getDefaultColumnVisibility(schema)`

Returns `{ [key]: false }` for every column marked with `.hidden()`:

```ts
import { getDefaultColumnVisibility } from "@/lib/data-grid/table-schema";

const visibility = getDefaultColumnVisibility(tableSchema.definition);
// Pass to the table variant:
<DataTable defaultColumnVisibility={visibility} ... />
```

---

## Manual Column Definition

If you prefer not to use the schema system, define `ColumnDef` manually:

```tsx
import { DataTableColumnHeader } from "@/components/data-grid/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";

type User = { id: string; name: string; email: string; role: string };

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ getValue }) => <span>{getValue() as string}</span>,
    size: 200,
    meta: { label: "Name" },
  },
  {
    accessorKey: "email",
    header: "Email",
    filterFn: "includesString",
    meta: { label: "Email" },
  },
  {
    accessorKey: "role",
    header: "Role",
    filterFn: "arrSome", // custom filter function — must be registered
    meta: { label: "Role" },
  },
];
```

### Registering Custom Filter Functions

If your columns use `inDateRange` or `arrSome`, register them on the table:

```ts
import { arrSome, inDateRange } from "@/lib/data-grid/table/filterfns";

const table = useReactTable({
  // ...
  filterFns: { inDateRange, arrSome },
});
```

> The `DataTable` and `DataTableTree` variants handle this automatically. `DataTableInfinite` registers them via the `filterFns` prop.

---

## Column Components (Reusable)

Located in `components/data-grid/data-table-column/`:

| Component                       | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `DataTableColumnTimestamp`      | Hover card with Unix timestamp, UTC, timezone, relative  |
| `DataTableColumnLevelIndicator` | Colored square for `error \| warning \| success \| info` |
| `DataTableColumnLatency`        | Formatted latency display                                |
| `DataTableColumnRegion`         | Region flag with code                                    |
| `DataTableColumnStatusCode`     | HTTP status with color coding                            |

### Usage in ColumnDef

```tsx
import { DataTableColumnLevelIndicator } from "@/components/data-grid/data-table-column/data-table-column-level-indicator";

{
  accessorKey: "level",
  header: "",
  cell: ({ row }) => {
    const level = row.getValue("level") as string;
    return <DataTableColumnLevelIndicator level={level} />;
  },
}
```
