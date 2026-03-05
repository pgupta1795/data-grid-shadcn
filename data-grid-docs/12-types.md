# Types Reference

All TypeScript types exported by the data-grid system.

---

## Core Component Types

### `DataTableFilterField<TData>`

Union type for filter sidebar fields:

```ts
type DataTableFilterField<TData> =
  | DataTableCheckboxFilterField<TData>
  | DataTableSliderFilterField<TData>
  | DataTableInputFilterField<TData>
  | DataTableTimerangeFilterField<TData>;
```

### Filter Field Variants

```ts
type Base<TData> = {
  label: string;
  value: keyof TData;
  defaultOpen?: boolean;
  commandDisabled?: boolean;
};

type DataTableCheckboxFilterField<TData> = Base<TData> & {
  type: "checkbox";
  options?: Option[];
  component?: (props: Option) => JSX.Element | null;
};

type DataTableSliderFilterField<TData> = Base<TData> & {
  type: "slider";
  min: number;
  max: number;
  options?: Option[];
};

type DataTableInputFilterField<TData> = Base<TData> & {
  type: "input";
  options?: Option[];
};

type DataTableTimerangeFilterField<TData> = Base<TData> & {
  type: "timerange";
  options?: Option[];
  presets?: DatePreset[];
};
```

### `Option`

```ts
type Option = {
  label: string;
  value: string | boolean | number | undefined;
};
```

### `DatePreset`

```ts
type DatePreset = {
  label: string;
  from: Date;
  to: Date;
  shortcut: string;
};
```

### `SheetField<TData, TMeta>`

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

### `BaseChartSchema`

```ts
type BaseChartSchema = { timestamp: number; [key: string]: number };
```

### `SearchParams`

```ts
type SearchParams = { [key: string]: string | string[] | undefined };
```

---

## Table Schema Types

### `ColKind`

```ts
type ColKind =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "enum"
  | "array"
  | "record";
```

### `FilterType`

```ts
type FilterType = "input" | "checkbox" | "slider" | "timerange";
```

### `DisplayConfig`

```ts
type DisplayConfig =
  | { type: "text" }
  | { type: "code" }
  | { type: "boolean" }
  | { type: "badge" }
  | { type: "timestamp" }
  | { type: "number"; unit?: string }
  | {
      type: "custom";
      cell: (value: unknown, row: unknown) => JSX.Element | null;
    };
```

### `FilterConfig`

```ts
type FilterConfig = {
  type: FilterType;
  defaultOpen: boolean;
  commandDisabled: boolean;
  options?: Option[];
  component?: (props: Option) => JSX.Element | null;
  min?: number;
  max?: number;
  presets?: DatePreset[];
};
```

### `SheetConfig`

```ts
type SheetConfig = {
  label?: string;
  component?: (row: unknown) => JSX.Element | null | string;
  condition?: (row: unknown) => boolean;
  className?: string;
  skeletonClassName?: string;
};
```

### `ColConfig`

```ts
type ColConfig = {
  kind: ColKind;
  enumValues?: readonly string[];
  arrayItem?: ColConfig;
  optional: boolean;
  label: string;
  description?: string;
  display: DisplayConfig;
  size?: number;
  hidden: boolean;
  sortable: boolean;
  filter: FilterConfig | null;
  sheet: SheetConfig | null;
};
```

### `ColBuilder<T, F>`

The fluent builder interface — see [Table Schema](./03-table-schema.md) for full API reference.

### `TableSchemaDefinition`

```ts
type TableSchemaDefinition = Record<string, ColBuilder<unknown, any>>;
```

### `InferTableType<T>`

Infers the row type from a schema definition:

```ts
type InferTableType<T extends TableSchemaDefinition> = {
  [K in keyof T]: T[K] extends ColBuilder<infer U, any> ? U : never;
};
```

### Serializable Descriptors

```ts
type ColumnDescriptor = {
  key: string;
  label: string;
  description?: string;
  dataType: ColKind;
  enumValues?: readonly string[];
  arrayItemType?: { dataType: ColKind; enumValues?: readonly string[] };
  optional: boolean;
  hidden: boolean;
  sortable: boolean;
  size?: number;
  display: { type: string; unit?: string };
  filter: FilterDescriptor | null;
  sheet: SheetDescriptor | null;
};

type FilterDescriptor = {
  type: FilterType;
  defaultOpen: boolean;
  commandDisabled: boolean;
  options?: Array<{ label: string; value: string | number | boolean }>;
  min?: number;
  max?: number;
};

type SheetDescriptor = {
  label?: string;
  className?: string;
  skeletonClassName?: string;
};

type SchemaJSON = {
  columns: ColumnDescriptor[];
};
```

---

## Context Types

### `DataTableContextType<TData, TValue>`

```ts
interface DataTableContextType<TData, TValue> {
  // State
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  columnOrder: string[];
  columnVisibility: VisibilityState;
  pagination: PaginationState;
  enableColumnOrdering: boolean;

  // Core
  table: Table<TData>;
  filterFields: DataTableFilterField<TData>[];
  columns: ColumnDef<TData, TValue>[];
  isLoading?: boolean;

  // Facets
  getFacetedUniqueValues?: (
    table: Table<TData>,
    columnId: string,
  ) => Map<string, number>;
  getFacetedMinMaxValues?: (
    table: Table<TData>,
    columnId: string,
  ) => undefined | [number, number];
}
```

---

## Re-exported from TanStack Table

The data-grid uses these TanStack Table types directly:

```ts
import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  Table,
  TableOptions,
  VisibilityState,
} from "@tanstack/react-table";
```
