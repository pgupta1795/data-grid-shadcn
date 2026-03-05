# State Management (BYOS)

**BYOS** (Bring Your Own Store) is a flexible adapter pattern that decouples the data-grid from any specific state management solution. It supports URL-based state (nuqs), client-side state (Zustand/React), or custom adapters.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Your Page / Route                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │          DataTableStoreProvider                     │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │        StoreContext (adapter)                 │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │  │
│  │  │  │useFilter │  │useFilter │  │useFilter │  │  │  │
│  │  │  │  State   │  │ Actions  │  │  Field   │  │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  DataTable / Infinite / Tree (React Table state)      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  DataTableStoreSync (one-way Table → BYOS)     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## `DataTableStoreProvider`

Wraps your table in a BYOS store context. Required for all table variants.

```tsx
import { DataTableStoreProvider } from "@/lib/data-grid/store";
import { useNuqsAdapter } from "@/lib/data-grid/store/adapters/nuqs";

function MyPage() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "my-table" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable ... />
    </DataTableStoreProvider>
  );
}
```

---

## Filter Schema (`createSchema` / `field.*`)

Defines the shape of your filter state with type-safe field builders.

```ts
import { createSchema, field } from "@/lib/data-grid/store/schema/schema";

export const filterSchema = createSchema({
  // Text input filters
  url: field.string(),
  name: field.string(),

  // Slider filter (numeric range)
  p95: field.array(field.number()).delimiter("-"),

  // Checkbox filters
  public: field.array(field.boolean()).delimiter(","),
  regions: field.array(field.stringLiteral(REGIONS)).delimiter(","),

  // Date range
  date: field.array(field.timestamp()).delimiter("-"),

  // Sort state
  sort: field.sort(),

  // Custom UI state
  live: field.boolean().default(false),
  uuid: field.string(),
});

// Infer the TS type:
export type FilterState = typeof filterSchema._type;
```

### Field Builders

| Builder                       | Type                            | Description                        |
| ----------------------------- | ------------------------------- | ---------------------------------- |
| `field.string()`              | `string`                        | Text value                         |
| `field.number()`              | `number`                        | Numeric value                      |
| `field.boolean()`             | `boolean`                       | Boolean value                      |
| `field.timestamp()`           | `Date`                          | Date/time value                    |
| `field.stringLiteral(values)` | `T[number]`                     | String union from `as const` array |
| `field.array(inner)`          | `U[]`                           | Array of inner field type          |
| `field.sort()`                | `{ id: string; desc: boolean }` | Sort state                         |

### Array Delimiters

| Delimiter | Constant           | Used For                   |
| --------- | ------------------ | -------------------------- |
| `,`       | `ARRAY_DELIMITER`  | Checkbox values            |
| `-`       | `SLIDER_DELIMITER` | Slider ranges, date ranges |
| `;`       | `RANGE_DELIMITER`  | Time ranges                |

---

## Adapters

### nuqs Adapter (URL State)

Syncs filter state to URL query parameters via [nuqs](https://nuqs.47ng.com).

```ts
import { useNuqsAdapter } from "@/lib/data-grid/store/adapters/nuqs";

const adapter = useNuqsAdapter(filterSchema.definition, {
  id: "my-table", // Prefix for query params to avoid collisions
});
```

**URL example:**

```
?level=error,warning&latency=0-500&sort=date.desc&uuid=abc-123
```

### Custom Adapters

Implement the adapter interface to use any state management:

```ts
type Adapter = {
  getState: () => Record<string, unknown>;
  setState: (updates: Record<string, unknown>) => void;
  subscribe: (listener: () => void) => () => void;
};
```

---

## `DataTableStoreSync`

A component (rendered inside `DataTableProvider`) that performs **one-way sync** from React Table state → BYOS adapter.

- Syncs **column filters** (Table → URL)
- Syncs **sorting** (Table → URL)
- Syncs **row selection** as `uuid` (Table → URL)
- Uses refs to track last-sent values, avoiding infinite loops
- Skips initial mount to prevent overwriting URL state on load

### Hook Version

```ts
import { useDataTableStoreSync } from "@/components/data-grid/data-table-store-sync";

// Use inside DataTableProvider for more control
useDataTableStoreSync();
```

---

## Store Hooks

### `useFilterState<T>(selector?)`

Read filter state from the BYOS adapter.

```ts
import { useFilterState } from "@/lib/data-grid/store";

// Full state:
const search = useFilterState<FilterState>();

// Selective:
const live = useFilterState<FilterState, boolean>((s) => s.live);
```

### `useFilterActions()`

Get setter functions to update BYOS state.

```ts
import { useFilterActions } from "@/lib/data-grid/store/hooks";

const { setFilters } = useFilterActions();

// Update multiple fields at once:
setFilters({ level: ["error", "warning"], sort: { id: "date", desc: true } });

// Clear a field:
setFilters({ level: null });
```

### `useFilterField(key)`

Read and write a single filter field.

```ts
import { useFilterField } from "@/lib/data-grid/store/hooks";

const { value, setValue } = useFilterField<string>("pathname");
```

### `useReactTableSync()`

Hook that syncs BYOS state back to React Table (reverse direction).

---

## `generateFilterSchema(tableSchema)`

Auto-generates a BYOS filter schema from your table schema definition. See [Filtering](./05-filtering.md#generatefilterschematableschema) for details.

```ts
import { generateFilterSchema } from "@/lib/data-grid/table-schema";

const autoSchema = generateFilterSchema(tableSchema);

// Compose with additional fields:
const filterSchema = createSchema({
  ...autoSchema.definition,
  sort: field.sort(),
  live: field.boolean().default(false),
  uuid: field.string(),
});
```
