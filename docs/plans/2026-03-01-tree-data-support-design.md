# Tree Data Support Design

**Date:** 2026-03-01
**Status:** Approved
**Feature:** Add tree/hierarchical data support to the data-grid component

---

## Summary

Add a `/tree` route to the data-table-filters project demonstrating hierarchical (tree) data rendering using TanStack Table v8's native sub-row support. All existing features from the `default` and `infinite` routes will be supported. A `registry.json` at the project root will make the component installable via `npx shadcn add`.

---

## Data Source

**File:** `ChildrenData.json` — a recursive PLM component tree from a 3DEXPERIENCE/ENOVIA system.

**Structure:**
```typescript
type TreeNode = {
  id: string;
  title: string;
  name: string;
  type: "VPMReference" | "VPMInstance";
  state: string;            // "IN_WORK" | "FROZEN" | etc.
  revision: string;         // "A", "B", etc.
  organization: string;
  owner: string;
  created: Date;
  modified: Date;
  collabspace: string;
  children?: TreeNode[];    // recursive children
  instances?: VPMInstance[];
};

type VPMInstance = {
  id: string;
  name: string;
  type: "VPMInstance";
  created: Date;
  modified: Date;
};
```

---

## Architecture

**Approach:** TanStack Table v8 native sub-rows (`getSubRows` + `getExpandedRowModel`)

**Key config options:**
```typescript
useReactTable({
  data,                                         // [rootNode] from ChildrenData.json
  getSubRows: (row) => row.children,            // tells TanStack where children live
  getExpandedRowModel: getExpandedRowModel(),   // enables expand/collapse
  filterFromLeafRows: true,                     // ancestor preservation on filter
  // All existing row models unchanged:
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  getFacetedMinMaxValues: getFacetedMinMaxValues(),
});
```

**Why this approach:**
- Native TanStack integration — no custom row model needed
- `filterFromLeafRows: true` handles ancestor preservation automatically
- Composes naturally with all existing row models
- Minimal new code

---

## New Files

```
src/app/tree/
├── page.tsx          # Server component, loads ChildrenData.json
├── client.tsx        # BYOS adapter setup (nuqs + zustand)
├── data-table.tsx    # useReactTable config with tree options
├── columns.tsx       # Column definitions with expand icon
├── constants.tsx     # filterFields array
├── schema.ts         # BYOS filter schema
├── store.ts          # Zustand store
├── types.ts          # TreeNode, VPMInstance types
└── data.ts           # Data loading + tree transformation
```

---

## Columns

| Column | Hideable | Sortable | Filter Type |
|--------|----------|----------|-------------|
| **Title** (with expand icon + indent) | No | No | Input |
| **Name** | Yes | Yes | Input |
| **Type** | Yes | Yes | Checkbox |
| **State** | Yes | Yes | Checkbox |
| **Revision** | Yes | Yes | Checkbox |
| **Organization** | Yes | No | — |
| **Collabspace** | Yes | Yes | Checkbox |
| **Instances** | Yes | Yes | Slider (count range) |
| **Modified** | Yes | Yes | Timerange |

**Title column expand UX:**
```tsx
cell: ({ row }) => (
  <div
    style={{ paddingLeft: `${row.depth * 16}px` }}
    className="flex items-center gap-1"
  >
    {row.getCanExpand() ? (
      <button onClick={row.getToggleExpandedHandler()}>
        {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
      </button>
    ) : (
      <span className="w-4" />   // leaf node spacer
    )}
    <span>{row.original.title}</span>
  </div>
)
```

---

## Filter Fields

All filter types from `default` and `infinite` routes, adapted for tree data:

| Field | Type | Notes |
|-------|------|-------|
| Title | Input | Options from flat traversal of all nodes |
| Name | Input | Options from flat traversal of all nodes |
| State | Checkbox | Dynamic values from data (IN_WORK, FROZEN, etc.) |
| Type | Checkbox | VPMReference, VPMInstance |
| Revision | Checkbox | Dynamic values from data (A, B, C…) |
| Collabspace | Checkbox | Dynamic values from data |
| Instances Count | Slider | min/max from data, range filter |
| Modified | Timerange | Date range picker with presets |

**Filter schema (BYOS):**
```typescript
export const filterSchema = createSchema({
  title: field.string(),
  name: field.string(),
  state: field.array(field.string()).delimiter(","),
  type: field.array(field.string()).delimiter(","),
  revision: field.array(field.string()).delimiter(","),
  collabspace: field.array(field.string()).delimiter(","),
  instancesCount: field.array(field.number()).delimiter("-"),
  modified: field.array(field.timestamp()).delimiter("-"),
  sort: field.sort(),
});
```

**filterFn patterns:**
- Input columns: string include check
- Checkbox columns: `Array.isArray(value) ? value.includes(rowValue) : value === rowValue`
- Slider column: range check `min <= value <= max`
- Timerange column: date range check
- `filterFromLeafRows: true` handles ancestor preservation for all filterFns

---

## Filtering Behavior

- **`filterFromLeafRows: true`**: If any descendant matches, the ancestor row is included
- When a filter is active, tree auto-expands matched branches
- Pagination counts only visible (expanded) rows — TanStack default behavior with `getPaginationRowModel()`

---

## Expand/Collapse UX

- Chevron icon inline in the Title column
- Depth-based left padding (`row.depth * 16px`)
- Leaf nodes show a spacer instead of chevron
- Expand state managed by TanStack (`expanded` state + `onExpandedChange`)
- Default: all rows collapsed (only root-level rows visible)

---

## Pagination

- **Mode:** Paginate visible rows only (TanStack default)
- Expanding a row adds children to the page count
- Pagination resets when filters change (existing behavior)
- Default page size: 10

---

## Registry

**File:** `registry.json` at project root

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "data-table-filters",
  "items": [
    {
      "name": "data-table",
      "type": "registry:block",
      "title": "Data Table with Filters",
      "description": "Advanced data table with filtering, sorting, pagination, column visibility, and command palette",
      "dependencies": [
        "@tanstack/react-table",
        "@tanstack/react-query",
        "nuqs",
        "zustand",
        "date-fns",
        "cmdk"
      ],
      "registryDependencies": [
        "table", "badge", "button", "checkbox", "accordion",
        "command", "popover", "slider", "calendar", "input"
      ],
      "files": [
        { "path": "src/components/data-table", "type": "registry:component" },
        { "path": "src/lib/store", "type": "registry:lib" }
      ]
    },
    {
      "name": "data-table-tree",
      "type": "registry:block",
      "title": "Data Table Tree View",
      "description": "Tree/hierarchical data support — expand/collapse rows, ancestor-preserving filters, all existing features",
      "registryDependencies": ["data-table"],
      "files": [
        { "path": "src/app/tree", "type": "registry:example" }
      ]
    }
  ]
}
```

**Usage:**
```bash
# Install base data table
npx shadcn add https://<your-domain>/registry.json data-table

# Install tree view example
npx shadcn add https://<your-domain>/registry.json data-table-tree
```

---

## What's Preserved (Existing Features)

- All filter types: input, checkbox, slider, timerange
- Command palette (`DataTableFilterCommand`)
- Filter controls sidebar (`DataTableFilterControls`)
- Column visibility toggle (`DataTableViewOptions`)
- Toolbar (`DataTableToolbar`)
- Pagination controls (`DataTablePagination`)
- BYOS adapter system (nuqs URL state + Zustand client state)
- Local storage column visibility persistence
- Faceted filtering with custom `getFacetedUniqueValues`
- Sorting via column headers

---

## Out of Scope

- Column reordering (dnd-kit) — not in `default` route, would complicate tree column
- Row selection — not required for tree view
- Live mode / infinite scroll — tree data is static
- Server-side filtering — tree data is loaded client-side from JSON
