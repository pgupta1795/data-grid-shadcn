# Example 3: Tree Data Table

A hierarchical table with expand/collapse, client-side pagination, and filtering. Ideal for file systems, org charts, or product structures.

---

## What this example demonstrates

- ✅ `DataTableTree` with hierarchical data
- ✅ Expand/collapse rows (`getSubRows`)
- ✅ Leaf-row filtering (parents stay visible when children match)
- ✅ Client-side pagination on expanded rows
- ✅ Manually defined `ColumnDef[]` with expand/collapse toggle
- ✅ BYOS with generic state adapter
- ✅ Recursive data transformation from JSON

---

## File Structure

```text
src/
├── App.tsx          # Entry component — renders DataTableTree
├── columns.tsx      # ColumnDef[] with expand toggle
├── constants.tsx    # filterFields configuration
├── data.ts          # Data transformation from JSON → TreeNode[]
├── types.ts         # TreeNode & VPMInstance types
├── schema.ts        # BYOS filter schema
├── store.ts         # Store export
└── skeleton.tsx     # Loading skeleton
```

---

## Step-by-Step

### 1. Define Your Hierarchical Type

```ts
// types.ts
export type TreeNode = {
  id: string;
  title: string;
  name: string;
  type: "VPMReference" | "VPMInstance";
  state: string;
  revision: string;
  organization: string;
  owner: string;
  created: Date;
  modified: Date;
  collabspace: string;
  description?: string;
  instances: VPMInstance[];
  instancesCount: number;
  children: TreeNode[]; // 👈 Recursive children
};
```

### 2. Transform Raw Data

```ts
// data.ts
import rawData from "../../../ChildrenData.json";

function transformNode(raw: Record<string, unknown>): TreeNode {
  return {
    id: raw.id as string,
    title: raw.title as string,
    name: raw.name as string,
    // ... other fields
    children: ((raw.children as unknown[]) ?? []).map((c) =>
      transformNode(c as Record<string, unknown>),
    ),
  };
}

export const treeData: TreeNode[] = [transformNode(rawData)];
```

### 3. Define Columns with Expand Toggle

```tsx
// columns.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";

export const columns: ColumnDef<TreeNode>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row, getValue }) => (
      <div
        style={{ paddingLeft: `${row.depth * 2}rem` }}
        className="flex items-center gap-2"
      >
        {row.getCanExpand() ? (
          <button onClick={row.getToggleExpandedHandler()}>
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                row.getIsExpanded() && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        {getValue() as string}
      </div>
    ),
    meta: { label: "Title" },
  },
  {
    accessorKey: "type",
    header: "Type",
    filterFn: "arrSome",
    meta: { label: "Type" },
  },
  {
    accessorKey: "state",
    header: "State",
    filterFn: "arrSome",
    meta: { label: "State" },
  },
  // ... more columns
];
```

> **Important:** Use `row.depth` to indent nested rows and `row.getToggleExpandedHandler()` for expand/collapse.

### 4. Define the Filter Schema

```ts
// schema.ts
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

### 5. Define Filter Fields

```tsx
// constants.tsx
export const filterFields: DataTableFilterField<TreeNode>[] = [
  { label: "Title", value: "title", type: "input" },
  { label: "Name", value: "name", type: "input" },
  {
    label: "State",
    value: "state",
    type: "checkbox",
    defaultOpen: true,
    options: uniqueStates.map((s) => ({ label: s, value: s })),
  },
  {
    label: "Type",
    value: "type",
    type: "checkbox",
    options: uniqueTypes.map((t) => ({ label: t, value: t })),
  },
  {
    label: "Instances",
    value: "instancesCount",
    type: "slider",
    min: 0,
    max: maxInstances,
    defaultOpen: true,
  },
  {
    label: "Modified",
    value: "modified",
    type: "timerange",
    commandDisabled: true,
  },
];
```

### 6. Render the Tree Table

```tsx
// App.tsx
import { DataTableTree } from "@/components/data-grid/data-table-tree";
import { DataTableStoreProvider } from "@/lib/data-grid/store";
// Use your preferred adapter (e.g. React state, router, etc.)
import { useNuqsAdapter } from "@/lib/data-grid/store/adapters/nuqs";

export function App() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "tree" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTableTree
        columns={columns}
        data={treeData}
        filterFields={filterFields}
        schema={filterSchema.definition}
        tableId="tree"
      />
    </DataTableStoreProvider>
  );
}
```

---

## Tree-Specific Configuration

### `getSubRows`

How the table finds children. Default: `(row) => row.children`.

```tsx
<DataTableTree
  getSubRows={(row) => row.children}  // default
/>

// Custom:
<DataTableTree
  getSubRows={(row) => row.subItems?.filter(item => item.visible)}
/>
```

### `filterFromLeafRows`

When `true` (default), a parent row stays visible if any descendant matches the filter:

```tsx
<DataTableTree
  filterFromLeafRows={true} // default
/>
```

When `false`, parents are filtered independently — a matching child won't keep an unmatched parent visible.

---

## Key Takeaways

1. **Recursive data** — `TreeNode` has a `children: TreeNode[]` field.
2. **Row depth indentation** — Use `row.depth` to indent cells visually.
3. **Expand/collapse** — Use `row.getCanExpand()` and `row.getToggleExpandedHandler()`.
4. **Leaf filtering** — `filterFromLeafRows: true` keeps parent paths visible.
5. **Pagination** — Applies to the flattened expanded view, not raw tree depth.
6. **Same BYOS** — State works identically to other variants.
