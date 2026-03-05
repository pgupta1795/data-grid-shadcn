# Sheet / Detail Panel

The **detail sheet** (drawer) slides open when a row is selected, showing extra fields not visible in the table. Primarily used by `DataTableInfinite`.

---

## `SheetField<TData, TMeta>`

Defines a single field in the row detail drawer.

```ts
type SheetField<TData, TMeta = Record<string, unknown>> = {
  id: keyof TData;
  label: string;
  type: "readonly" | "input" | "checkbox" | "slider" | "timerange";
  component?: (
    props: TData & {
      metadata?: {
        totalRows: number;
        filterRows: number;
        totalRowsFetched: number;
      } & TMeta;
    },
  ) => JSX.Element | null | string;
  condition?: (props: TData) => boolean;
  className?: string;
  skeletonClassName?: string;
};
```

| Property            | Type                                                             | Description                                                 |
| ------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `id`                | `keyof TData`                                                    | Column key to display                                       |
| `label`             | `string`                                                         | Field label shown in the drawer                             |
| `type`              | `"readonly" \| "input" \| "checkbox" \| "slider" \| "timerange"` | Derived from filter type, or `"readonly"` if not filterable |
| `component`         | `(row & metadata) => JSX`                                        | Custom renderer; receives the full row data + metadata      |
| `condition`         | `(row) => boolean`                                               | Only show this field when condition is true                 |
| `className`         | `string`                                                         | CSS class on the field container                            |
| `skeletonClassName` | `string`                                                         | CSS class for the loading skeleton placeholder              |

---

## `generateSheetFields(schema)`

Generates `SheetField[]` from a `TableSchemaDefinition`. Only includes columns where `.sheet()` was called.

```ts
import { generateSheetFields } from "@/lib/data-grid/table-schema";

const sheetFields = generateSheetFields<ColumnSchema>(tableSchema.definition);
```

### Rules

- Sheet type is derived from the column's filter type, or `"readonly"` if not filterable
- Sheet label falls back to the column label if not overridden in `.sheet({ label })`
- Order follows schema definition order

---

## Sheet Components

### `DataTableSheetDetails`

The outer drawer/sheet container. Wraps `MemoizedDataTableSheetContent`.

```tsx
<DataTableSheetDetails
  title={renderSheetTitle({ row: selectedRow })}
  titleClassName="font-mono"
>
  <MemoizedDataTableSheetContent ... />
</DataTableSheetDetails>
```

### `MemoizedDataTableSheetContent`

Memoized inner content that renders each sheet field.

```tsx
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
```

### `DataTableSheetRowAction`

Row-level action button that opens the sheet. Used within table rows.

---

## Example: Defining Sheet Fields via Schema

```ts
const tableSchema = createTableSchema({
  date: col.timestamp().label("Date").sortable().size(200).sheet({
    component: (props) => format(new Date(props.date), "LLL dd, y HH:mm:ss"),
    skeletonClassName: "w-36",
  }),

  uuid: col.string().label("Request Id").notFilterable().hidden().sheet({
    label: "Request ID",
    skeletonClassName: "w-64",
  }),

  latency: col.number().label("Latency").sortable().sheet({
    component: (props) => <>{props.latency}ms</>,
    skeletonClassName: "w-16",
  }),

  headers: col.record().label("Headers").hidden().sheet({
    component: (props) => <KVTabs data={props.headers} />,
    className: "flex-col items-start w-full gap-1",
  }),

  message: col.string().optional().label("Message").notFilterable().hidden().sheet({
    condition: (props) => props.message !== undefined,
    component: (props) => <CodeBlock>{JSON.stringify(props.message, null, 2)}</CodeBlock>,
    className: "flex-col items-start w-full gap-1",
  }),
});
```

---

## Using with `DataTableInfinite`

The infinite variant has built-in sheet support:

```tsx
<DataTableInfinite
  sheetFields={sheetFields}
  renderSheetTitle={({ row }) => row?.original.pathname}
  meta={metadata}
  // ... other props
/>
```

The `meta` object is merged with `{ totalRows, filterRows, totalRowsFetched }` and passed to sheet field components as `props.metadata`.
