# Hooks Reference

---

## Data Table Hooks

### `useDataTable<TData, TValue>()`

Access the data-table context from any component inside `DataTableProvider`.

```ts
import { useDataTable } from "@/components/data-grid/data-table-provider";

const {
  table, // TanStack Table instance
  columns, // ColumnDef[]
  filterFields, // DataTableFilterField[]
  columnFilters, // ColumnFiltersState
  sorting, // SortingState
  rowSelection, // RowSelectionState
  columnOrder, // string[]
  columnVisibility, // VisibilityState
  pagination, // PaginationState
  enableColumnOrdering, // boolean
  isLoading, // boolean | undefined
  getFacetedUniqueValues, // (table, columnId) => Map
  getFacetedMinMaxValues, // (table, columnId) => [min, max]
} = useDataTable<MyRow>();
```

> **Throws** if used outside `DataTableProvider`.

---

## BYOS Store Hooks

### `useFilterState<T, R>(selector?)`

Read filter state from the BYOS adapter. Supports optional selector for granular subscriptions.

```ts
import { useFilterState } from "@/lib/data-grid/store";

// Read entire state:
const state = useFilterState<FilterState>();

// Read a single field (optimized — only re-renders when this field changes):
const live = useFilterState<FilterState, boolean>((s) => s.live);
const sort = useFilterState<FilterState, FilterState["sort"]>((s) => s.sort);

// Use in computed values:
const hasFilters = useFilterState<FilterState, boolean>((s) =>
  Boolean(s.level?.length || s.status?.length),
);
```

### `useFilterActions()`

Get setter function to update BYOS state.

```ts
import { useFilterActions } from "@/lib/data-grid/store/hooks";

type FilterActions = {
  setFilters: (updates: Record<string, unknown>) => void;
};

const { setFilters } = useFilterActions();

// Set multiple fields:
setFilters({
  level: ["error", "warning"],
  sort: { id: "date", desc: true },
});

// Clear a field:
setFilters({ level: null });
```

### `useFilterField<T>(key: string)`

Convenience hook for reading and writing a single filter field.

```ts
import { useFilterField } from "@/lib/data-grid/store/hooks";

type FilterFieldResult<T> = {
  value: T;
  setValue: (value: T | null) => void;
};

const { value, setValue } = useFilterField<string[]>("regions");

// Set value:
setValue(["ams", "gru"]);

// Clear:
setValue(null);
```

### `useReactTableSync()`

Syncs BYOS state back to React Table (reverse direction of `DataTableStoreSync`).

```ts
import { useReactTableSync } from "@/lib/data-grid/store/hooks";

// Call inside DataTableProvider
useReactTableSync();
```

---

## Utility Hooks

### `useHotKey(callback, key)`

Register a keyboard shortcut. Fires on `⌘+key` (Mac) or `Ctrl+key` (Windows).

```ts
import { useHotKey } from "@/hooks/use-hot-key";

useHotKey(() => setOpen((prev) => !prev), "b"); // ⌘B
useHotKey(() => refetch(), "r"); // ⌘R
useHotKey(() => resetColumns(), "u"); // ⌘U
```

### `useLocalStorage<T>(key, initialValue)`

Persist state to `localStorage` with type safety.

```ts
import { useLocalStorage } from "@/hooks/use-local-storage";

const [value, setValue] = useLocalStorage<VisibilityState>(
  "my-table-column-visibility",
  { secret: false },
);
```

### `useDebounce<T>(value, delay)`

Debounce a value with a configurable delay.

```ts
import { useDebounce } from "@/hooks/use-debounce";

const [input, setInput] = useState("");
const debouncedInput = useDebounce(input, 500);

useEffect(() => {
  column?.setFilterValue(debouncedInput || null);
}, [debouncedInput]);
```

### `useMediaQuery(query)`

Responsive breakpoint hook.

```ts
import { useMediaQuery } from "@/hooks/use-media-query";

const isDesktop = useMediaQuery("(min-width: 768px)");
```

### `useCopyToClipboard()`

Copy text to clipboard with success state.

```ts
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

const [copiedValue, copy] = useCopyToClipboard();
```

---

## Controls Hook

### `useControls()`

Access the filter sidebar open/closed state.

```ts
import { useControls } from "@/components/data-grid/providers/controls";

const { open, setOpen } = useControls();
// open: boolean
// setOpen: Dispatch<SetStateAction<boolean>>
```
