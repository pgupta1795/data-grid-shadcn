# Filtering

The data-grid provides a rich, multi-type filtering system with a sidebar, command palette, and automatic BYOS sync.

---

## Filter Field Types

Defined in `components/data-grid/types.ts`:

### `DataTableFilterField<TData>`

A union type of four filter variants:

```ts
type DataTableFilterField<TData> =
  | DataTableCheckboxFilterField<TData>
  | DataTableSliderFilterField<TData>
  | DataTableInputFilterField<TData>
  | DataTableTimerangeFilterField<TData>;
```

### Common Base Properties

| Property          | Type                                               | Description                         |
| ----------------- | -------------------------------------------------- | ----------------------------------- |
| `label`           | `string`                                           | Display label in the filter sidebar |
| `value`           | `keyof TData`                                      | Column key to filter on             |
| `type`            | `"checkbox" \| "slider" \| "input" \| "timerange"` | Filter UI type                      |
| `defaultOpen`     | `boolean?`                                         | Accordion starts open               |
| `commandDisabled` | `boolean?`                                         | Exclude from command palette search |

### Checkbox (`type: "checkbox"`)

Multi-select from a list of options. Supports custom rendering per option.

| Extra Props | Type                             | Description                                             |
| ----------- | -------------------------------- | ------------------------------------------------------- |
| `options`   | `Option[]`                       | `{ label: string; value: string \| boolean \| number }` |
| `component` | `(props: Option) => JSX.Element` | Custom option renderer                                  |

```ts
{
  label: "Status",
  value: "status",
  type: "checkbox",
  options: [
    { label: "200", value: 200 },
    { label: "400", value: 400 },
    { label: "500", value: 500 },
  ],
  component: (props) => (
    <span className={cn("font-mono", getStatusColor(props.value).text)}>
      {props.value}
    </span>
  ),
}
```

**Features:**

- Searchable when > 4 options (auto-shows search input)
- Shows faceted count per option (from table or server-side facets)
- "Only" button to select a single value exclusively
- Loading skeleton when `isLoading` is true and no options

### Slider (`type: "slider"`)

Numeric range filter with min/max inputs and a slider control.

| Extra Props | Type     | Description   |
| ----------- | -------- | ------------- |
| `min`       | `number` | Minimum bound |
| `max`       | `number` | Maximum bound |

```ts
{
  label: "Latency",
  value: "latency",
  type: "slider",
  min: 0,
  max: 5000,
}
```

**Features:**

- Debounced input (500ms) to avoid excessive re-renders
- Synchronized text inputs and slider thumb positions
- Faceted min/max from table or server-side

### Input (`type: "input"`)

Free-text search with debounced filtering.

```ts
{
  label: "Pathname",
  value: "pathname",
  type: "input",
}
```

**Features:**

- 500ms debounce on input changes
- Clears filter when input is emptied
- Matches via `includesString` filter function

### Timerange (`type: "timerange"`)

Date range picker with optional presets.

| Extra Props | Type            | Description              |
| ----------- | --------------- | ------------------------ |
| `presets`   | `DatePreset[]?` | Quick-select date ranges |

```ts
{
  label: "Date Range",
  value: "date",
  type: "timerange",
  defaultOpen: true,
  commandDisabled: true,
  presets: [
    { label: "Last 24h", from: subDays(new Date(), 1), to: new Date(), shortcut: "d" },
    { label: "Last 7d", from: subDays(new Date(), 7), to: new Date(), shortcut: "w" },
  ],
}
```

---

## `generateFilterFields(schema)`

Generates `DataTableFilterField[]` from a `TableSchemaDefinition`. Only includes columns where `filter !== null`.

```ts
import { generateFilterFields } from "@/lib/data-grid/table-schema";

const filterFields = generateFilterFields<MyRow>(tableSchema.definition);
```

### Auto-derived options

- `col.enum(values)` → checkbox options from `values`
- `col.boolean()` → `[{ label: "Yes", value: true }, { label: "No", value: false }]`
- `col.array(col.enum(values))` → checkbox options from inner enum values
- Other types: options must be provided via `.filterable("checkbox", { options })`

---

## `DataTableFilterControls`

The sidebar component that renders all filter fields as an accordion.

```tsx
// Automatic in all table variants — no manual rendering needed.
// Uses filterFields from DataTableProvider context.
```

### Behavior

- Reads `filterFields` from `DataTableProvider` context
- Renders each filter in an `<Accordion>` section
- Shows filter key (monospace) when it differs from the label
- Each section has a per-field reset button
- Responsive: hidden on mobile, uses drawer instead

### `DataTableFilterControlsDrawer`

Mobile-friendly version that opens the filter controls in a bottom drawer:

```tsx
// Automatic on mobile — rendered by DataTableToolbar when screen is < sm
```

---

## `DataTableFilterCommand`

A command palette (⌘K style) for text-based filter search. Serializes current filters into a `key:value` syntax.

```tsx
// Automatic in all table variants
// Pass schema and tableId:
<DataTableFilterCommand schema={filterSchema.definition} tableId="my-table" />
```

### Syntax

```
status:200,400 level:error,warning latency:0-500 pathname:/api
```

- Checkbox values: comma-separated (`status:200,400`)
- Slider ranges: dash-separated (`latency:0-500`)
- Timerange: dash-separated timestamps (`date:1709251200000-1709337600000`)
- Text input: plain value (`pathname:/api`)

---

## `generateFilterSchema(tableSchema)`

Generates a BYOS filter schema from a `TableSchemaDefinition`:

```ts
import { generateFilterSchema } from "@/lib/data-grid/table-schema";

// Auto-derives field.* builders from col.* configurations:
const autoSchema = generateFilterSchema(tableSchema);

// Compose with additional UI state:
const filterSchema = createSchema({
  ...autoSchema.definition,
  sort: field.sort(),
  live: field.boolean().default(false),
  uuid: field.string(),
});
```

### Mapping Rules

| Column Kind              | Filter Type   | Generated Field                                             |
| ------------------------ | ------------- | ----------------------------------------------------------- |
| `col.string()`           | `"input"`     | `field.string()`                                            |
| `col.number()`           | `"input"`     | `field.number()`                                            |
| `col.number()`           | `"slider"`    | `field.array(field.number()).delimiter(SLIDER_DELIMITER)`   |
| `col.number()`           | `"checkbox"`  | `field.array(field.number()).delimiter(ARRAY_DELIMITER)`    |
| `col.boolean()`          | `"checkbox"`  | `field.array(field.boolean()).delimiter(ARRAY_DELIMITER)`   |
| `col.timestamp()`        | `"timerange"` | `field.array(field.timestamp()).delimiter(RANGE_DELIMITER)` |
| `col.enum(v)`            | `"checkbox"`  | `field.array(field.stringLiteral(v))`                       |
| `col.array(col.enum(v))` | `"checkbox"`  | `field.array(field.stringLiteral(v))`                       |

---

## Reset Buttons

### `DataTableResetButton`

Resets **all** column filters on the table.

```tsx
// Automatic in DataTableToolbar — shown when filters are active
```

### `DataTableFilterResetButton`

Resets a **single** filter field. Shown per-accordion in the sidebar.

```tsx
// Automatic in DataTableFilterControls
```

---

## Server-Side Facets

For server-side datasets, provide faceted values via props:

```tsx
<DataTableInfinite
  getFacetedUniqueValues={(table, columnId) => {
    // Return Map<string, number> from your server response
    return new Map(
      facets[columnId]?.rows.map(({ value, total }) => [value, total]),
    );
  }}
  getFacetedMinMaxValues={(table, columnId) => {
    // Return [min, max] tuple
    const { min, max } = facets[columnId] ?? {};
    return typeof min === "number" && typeof max === "number"
      ? [min, max]
      : undefined;
  }}
/>
```
