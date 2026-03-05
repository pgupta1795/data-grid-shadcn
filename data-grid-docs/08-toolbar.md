# Toolbar & View Options

---

## `DataTableToolbar`

The main toolbar rendered above the table in all variants. It provides:

- **Toggle Controls Button** — Show/hide the filter sidebar (keyboard: `⌘B`)
- **Row Count Display** — `X of Y row(s) filtered`
- **Mobile Filter Drawer** — Opens `DataTableFilterControlsDrawer` on small screens
- **Reset Button** — Clears all active filters (shown only when filters are active)
- **Custom Actions** — Via `renderActions` slot
- **View Options** — Column visibility and ordering

### Props

| Prop            | Type              | Description                                          |
| --------------- | ----------------- | ---------------------------------------------------- |
| `renderActions` | `() => ReactNode` | Custom action buttons between reset and view options |

### Usage

All three table variants render the toolbar automatically. To inject custom actions:

```tsx
<DataTable
  renderActions={() => (
    <>
      <DataTableRefreshButton onClick={refetch} />
      <LiveButton fetchPreviousPage={fetchPreviousPage} />
    </>
  )}
/>
```

### Keyboard Shortcut

- **`⌘B`** — Toggle filter controls sidebar visibility

---

## `DataTableViewOptions`

A popover dropdown for managing column visibility and order. Accessed via the ⚙️ button in the toolbar.

### Features

- **Column visibility toggles** — Checkbox per column (only columns with `accessorFn`/`accessorKey` and `getCanHide()`)
- **Search** — Filter the column list by name
- **Drag-and-drop ordering** — When `enableColumnOrdering` is true (default for `DataTableInfinite`)
- **Column label** — Shows `meta.label` when available, falls back to column `id`

### Column Ordering

Enabled by passing `enableColumnOrdering={true}` to `DataTableProvider`. `DataTableInfinite` enables this by default.

- Drag handles appear next to each column name (hidden during search)
- Order is persisted to `localStorage` via `getColumnOrderKey(tableId)`
- **`⌘U`** — Reset column order and visibility to defaults

### Column Visibility Persistence

Visibility is stored in `localStorage`:

```ts
// Key format: "data-table-{tableId}-column-visibility"
const key = getColumnVisibilityKey(tableId);
// Stored as: { "timing.dns": false, headers: false, ... }
```

---

## Render Slots

All three table variants support render slots for customization:

### `renderActions`

Renders after the reset button and before view options in the toolbar.

```tsx
renderActions={() => (
  <div className="flex gap-2">
    <Button onClick={refetch} size="sm">Refresh</Button>
    <ExportButton />
  </div>
)}
```

### `renderChart`

Renders below the toolbar/command bar, above the table.

```tsx
renderChart={() => (
  <TimelineChart data={chartData} columnId="date" />
)}
```

### `renderSidebarFooter`

Renders at the bottom of the filter sidebar.

```tsx
renderSidebarFooter={() => (
  <p className="text-xs text-muted-foreground">
    Last updated: {lastUpdated}
  </p>
)}
```

### `renderLiveRow` (Infinite only)

Inject a visual separator row for live data streams:

```tsx
renderLiveRow={({ row }) => {
  if (row.original.uuid !== liveAnchor.uuid) return null;
  return <LiveRow colSpan={columns.length - 1} />;
}}
```

### `renderSheetTitle` (Infinite only)

Custom title for the row detail drawer:

```tsx
renderSheetTitle={({ row }) => row?.original.pathname}
```

---

## `ControlsProvider`

Internal context that manages the open/closed state of the filter sidebar. Used by the toolbar and filter controls.

```ts
const { open, setOpen } = useControls();
// open: boolean — is the sidebar visible?
// setOpen: (boolean | (prev => boolean)) — toggle or set
```

The sidebar is wrapped in a `data-expanded` attribute:

```html
<div data-expanded="true" class="group/controls">
  <!-- Sidebar uses group-data-[expanded=false]/controls:hidden -->
</div>
```

---

## `DataTableRefreshButton`

A simple refresh button that calls a provided `onClick` handler:

```tsx
import { DataTableRefreshButton } from "@/components/data-grid/data-table-refresh-button";

<DataTableRefreshButton onClick={() => refetch()} />;
```
