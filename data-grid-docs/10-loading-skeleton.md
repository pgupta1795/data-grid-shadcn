# Loading & Skeleton States

The data-grid provides comprehensive loading states at every level: table, filters, sheet, and individual cells.

---

## Loading Props

### `isLoading`

Indicates the initial data load (no data available yet). Affects:

| Component                 | Behavior                                       |
| ------------------------- | ---------------------------------------------- |
| `DataTableFilterCheckbox` | Shows skeleton placeholders instead of options |
| `DataTableToolbar`        | Loading indicator                              |
| `DataTableSheetContent`   | Shows skeleton rows in the detail panel        |
| Row rendering             | Table shows "No results." until data arrives   |

### `isFetching`

Indicates a background fetch (data is already available, but updating). Affects:

| Component           | Behavior                                         |
| ------------------- | ------------------------------------------------ |
| `DataTableInfinite` | "Load More" button shows spinner, disables click |
| `DataTableToolbar`  | Subtle loading indicator                         |
| Sheet content       | May show stale data during fetch                 |

### Usage

```tsx
<DataTable isLoading={isLoading} />

<DataTableInfinite
  isLoading={isLoading}    // Initial load
  isFetching={isFetching}  // Background updates
/>
```

---

## `DataTableSkeleton`

A standalone skeleton component for use in loading pages (`loading.tsx`):

```tsx
import { DataTableSkeleton } from "@/components/data-grid/data-table-skeleton";

export default function Loading() {
  return <DataTableSkeleton rows={10} />;
}
```

### Props

| Prop   | Type     | Default | Description                       |
| ------ | -------- | ------- | --------------------------------- |
| `rows` | `number` | `10`    | Number of skeleton rows to render |

### Renders

- 5 skeleton header cells (2 hidden on mobile, 1 hidden on tablet)
- N skeleton body rows with varying widths
- Responsive column visibility matching the header

---

## Filter Skeleton States

### Checkbox Filter

When `isLoading` is true and no options are available:

```
┌────────────────────────┐
│ ▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└────────────────────────┘
```

Shows 3 rows with checkbox + label skeleton placeholders.

### Faceted Count Skeleton

When `isLoading` is true but options are defined, faceted counts show individual `<Skeleton>` elements instead of numbers.

---

## Sheet Skeleton States

Each `SheetField` can define a `skeletonClassName` for its loading placeholder:

```ts
col.string().label("Host").sheet({ skeletonClassName: "w-24" });
col.timestamp().label("Date").sheet({ skeletonClassName: "w-36" });
col.number().label("Latency").sheet({ skeletonClassName: "w-16" });
```

When the sheet opens but data hasn't loaded yet, skeleton bars appear matching the configured widths.

---

## Page-Level Loading Pattern

Complete loading page example for Next.js App Router:

```tsx
// app/my-table/loading.tsx
import { DataTableSkeleton } from "@/components/data-grid/data-table-skeleton";

export default function Loading() {
  return (
    <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
      {/* Sidebar skeleton */}
      <div className="hidden sm:block sm:min-w-52 sm:max-w-52 md:min-w-64 md:max-w-64">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
      {/* Table skeleton */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-1">
        <Skeleton className="h-9 w-full rounded-md" /> {/* Command bar */}
        <Skeleton className="h-9 w-48 rounded-md" /> {/* Toolbar */}
        <DataTableSkeleton rows={20} />
      </div>
    </div>
  );
}
```
