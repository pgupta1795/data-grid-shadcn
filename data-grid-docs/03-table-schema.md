# Table Schema System

The **table-schema** system lets you define your entire table (columns, filters, display, sheet details) from a single declarative object. Generators then produce `ColumnDef[]`, `DataTableFilterField[]`, `SheetField[]`, and a BYOS `SchemaDefinition` — all type-safe and zero-boilerplate.

---

## `createTableSchema(definition)`

Creates a validated schema object from a map of `col.*` builders.

```ts
import { col, createTableSchema } from "@/lib/data-grid/table-schema";

export const tableSchema = createTableSchema({
  name: col.string().label("Name").size(200),
  status: col
    .enum(["active", "inactive"] as const)
    .label("Status")
    .defaultOpen(),
  latency: col
    .number()
    .label("Latency")
    .display("number", { unit: "ms" })
    .filterable("slider", { min: 0, max: 5000 })
    .sortable(),
  createdAt: col
    .timestamp()
    .label("Created")
    .sortable()
    .commandDisabled()
    .size(200)
    .sheet(),
});
```

### Returns

```ts
{
  definition: T;        // The original schema definition
  toJSON(): SchemaJSON;  // Serializable descriptor (function-free JSON)
}
```

### `InferTableType<typeof tableSchema.definition>`

Infers the TypeScript row type from your schema:

```ts
import type { InferTableType } from "@/lib/data-grid/table-schema";

type Row = InferTableType<typeof tableSchema.definition>;
// => { name: string; status: "active" | "inactive"; latency: number; createdAt: Date }
```

---

## Column Factories (`col.*`)

| Factory            | Data Type                | Default Display | Default Filter   | Allowed Filters                     |
| ------------------ | ------------------------ | --------------- | ---------------- | ----------------------------------- |
| `col.string()`     | `string`                 | `"text"`        | `"input"`        | `"input"`                           |
| `col.number()`     | `number`                 | `"number"`      | `"input"`        | `"input"`, `"slider"`, `"checkbox"` |
| `col.boolean()`    | `boolean`                | `"boolean"`     | `"checkbox"`     | `"checkbox"`                        |
| `col.timestamp()`  | `Date`                   | `"timestamp"`   | `"timerange"`    | `"timerange"`                       |
| `col.enum(values)` | `T[number]`              | `"badge"`       | `"checkbox"`     | `"checkbox"`                        |
| `col.array(item)`  | `U[]`                    | `"badge"`       | `"checkbox"`     | `"checkbox"`                        |
| `col.record()`     | `Record<string, string>` | `"text"`        | _not filterable_ | _none_                              |

---

## Builder Methods (Fluent API)

Every `col.*` factory returns a `ColBuilder<T, F>` with these chainable methods:

### `.label(text: string)`

Sets the header label shown in the table column and filter sidebar.

```ts
col.string().label("Host Name");
```

### `.description(text: string)`

Human-readable description for AI agents / MCP tools (via `toJSON()`). Not shown in the UI.

```ts
col.number().label("Latency").description("Round-trip time in milliseconds");
```

### `.display(type, options?)`

Controls how the cell value is rendered.

| Type          | Description                                 | Options                                 |
| ------------- | ------------------------------------------- | --------------------------------------- |
| `"text"`      | Plain text, truncated with tooltip          | —                                       |
| `"code"`      | Monospace font (IDs, hashes)                | —                                       |
| `"boolean"`   | Checkmark / dash icon                       | —                                       |
| `"badge"`     | Colored chip                                | —                                       |
| `"timestamp"` | Relative time ("3m ago"), absolute on hover | —                                       |
| `"number"`    | Formatted number                            | `{ unit?: string }`                     |
| `"custom"`    | Developer-supplied JSX                      | `{ cell: (value, row) => JSX.Element }` |

```ts
col.number().display("number", { unit: "ms" })
col.enum(LEVELS).display("custom", { cell: (value) => <LevelBadge value={value} /> })
```

### `.filterable(type, options?)`

Enables filtering with the specified filter UI type. Only types valid for the column kind are accepted at compile time.

```ts
col.string().filterable("input");
col.number().filterable("slider", { min: 0, max: 5000 });
col
  .enum(VALUES)
  .filterable("checkbox", {
    options: VALUES.map((v) => ({ label: v, value: v })),
  });
col.timestamp().filterable("timerange");
```

### `.notFilterable()`

Removes filtering. After calling this, `.filterable()` becomes a compile-time error (F = never).

```ts
col.string().label("Request ID").notFilterable().hidden();
```

### `.defaultOpen()`

Opens the filter accordion by default in the sidebar.

```ts
col.enum(LEVELS).label("Level").filterable("checkbox").defaultOpen();
```

### `.commandDisabled()`

Excludes this field from the command palette (⌘K) filter search.

```ts
col.timestamp().label("Date").filterable("timerange").commandDisabled();
```

### `.hidden()`

Hides the column by default. Users can toggle visibility via View Options.

```ts
col.number().label("DNS").filterable("slider", { min: 0, max: 5000 }).hidden();
```

### `.size(px: number)`

Fixed column width in pixels.

```ts
col.timestamp().label("Date").size(200);
```

### `.sortable()`

Enables click-to-sort with ascending/descending/none controls.

```ts
col.timestamp().label("Date").sortable();
col.number().label("Latency").sortable();
```

### `.optional()`

Marks the field as `T | undefined` in the inferred type.

```ts
col.number().optional().label("Percentile").notFilterable().hidden();
```

### `.sheet(config?)`

Includes this column in the row detail drawer.

```ts
col.string().label("Host").sheet()
col.number().label("Latency").sheet({
  component: (row) => <>{row.latency}ms</>,
  skeletonClassName: "w-16",
})
col.record().label("Headers").hidden().sheet({
  component: (row) => <KVTabs data={row.headers} />,
  className: "flex-col items-start w-full gap-1",
})
```

| Config Key          | Type                     | Description                            |
| ------------------- | ------------------------ | -------------------------------------- |
| `label`             | `string`                 | Override the column label in the sheet |
| `component`         | `(row) => JSX \| string` | Custom renderer                        |
| `condition`         | `(row) => boolean`       | Only show field when condition is true |
| `className`         | `string`                 | CSS class for the field container      |
| `skeletonClassName` | `string`                 | CSS class for the loading skeleton     |

---

## Presets (`col.presets.*`)

Pre-configured builders for common patterns:

| Preset                                 | Based On          | Defaults                            |
| -------------------------------------- | ----------------- | ----------------------------------- |
| `col.presets.logLevel(values)`         | `col.enum()`      | badge + checkbox + `defaultOpen`    |
| `col.presets.httpMethod(values)`       | `col.enum()`      | text + checkbox                     |
| `col.presets.httpStatus(codes?)`       | `col.number()`    | checkbox with standard HTTP codes   |
| `col.presets.duration(unit?, slider?)` | `col.number()`    | number display + slider `{0, 5000}` |
| `col.presets.timestamp()`              | `col.timestamp()` | timestamp display + sortable        |
| `col.presets.traceId()`                | `col.string()`    | code display + notFilterable        |
| `col.presets.pathname()`               | `col.string()`    | text display + input filter         |

```ts
const tableSchema = createTableSchema({
  level: col.presets.logLevel(LEVELS).description("Log severity"),
  date: col.presets.timestamp().label("Date").size(200).sheet(),
  latency: col.presets
    .duration("ms")
    .label("Latency")
    .sortable()
    .size(110)
    .sheet(),
  status: col.presets.httpStatus().label("Status").size(60),
  method: col.presets.httpMethod(METHODS).size(69),
  path: col.presets.pathname().label("Path").size(130).sheet(),
  traceId: col.presets.traceId().label("Request ID").hidden().sheet(),
});
```

---

## JSON Serialization

Schemas can be serialized to function-free JSON for AI agents, MCP tools, or storage:

```ts
// Serialize
const json = tableSchema.toJSON();
// Also works: JSON.stringify(tableSchema)

// Reconstruct
const reconstructed = createTableSchema.fromJSON(json);
```

> **Note:** Custom renderers (`display.cell`, `filter.component`, `sheet.component`) are not serialized and must be applied manually on top of the reconstructed builders.

---

## `getDefaultColumnVisibility(schema)`

Derives a `VisibilityState` from the schema — returns `{ [key]: false }` for every column marked with `.hidden()`.

```ts
import { getDefaultColumnVisibility } from "@/lib/data-grid/table-schema";

const defaultColumnVisibility = getDefaultColumnVisibility(
  tableSchema.definition,
);
// => { "timing.dns": false, "timing.tls": false, headers: false, ... }
```
