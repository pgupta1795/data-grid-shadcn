# Sorting & Pagination

---

## Sorting

### Enabling Sort on a Column

**Via table schema:**

```ts
col.timestamp().label("Date").sortable();
col.number().label("Latency").sortable();
```

**Via manual ColumnDef:**

```tsx
{
  accessorKey: "date",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  enableSorting: true,
}
```

### Sort Behavior

- **Click cycle:** none → ascending → descending → none
- **Single sort:** Only one column is sorted at a time
- **State type:** `SortingState` from TanStack Table (`{ id: string; desc: boolean }[]`)
- **Default sort:** Pass `defaultSorting` (DataTable/Tree) or `defaultColumnSorting` (Infinite):

```tsx
<DataTable defaultSorting={[{ id: "date", desc: true }]} />
<DataTableInfinite defaultColumnSorting={[{ id: "date", desc: true }]} />
```

### URL Sync via BYOS

Sorting is automatically synced to the URL via the BYOS store system (`DataTableStoreSync`):

```ts
// In your filter schema:
const filterSchema = createSchema({
  // ... filters
  sort: field.sort(), // Adds sort state to URL
});
```

The sync sets `sort` in the BYOS adapter whenever the user changes the sort on the table.

---

## Pagination

### `DataTablePagination` Component

A full-featured pagination bar rendered at the bottom of `DataTable` and `DataTableTree`.

**Features:**

- **Rows per page selector:** Dropdown with 10, 20, 30, 40, 50 options
- **Page indicator:** "Page X of Y"
- **Navigation buttons:** First / Previous / Next / Last
- **Disabled states:** Buttons disable when at the boundary
- **Auto-reset:** Pagination resets to page 0 when filters change

### Default Pagination State

```tsx
<DataTable defaultPagination={{ pageIndex: 0, pageSize: 10 }} />
```

### Pagination in Tree Tables

`DataTableTree` paginates over the **expanded** (visible) rows, not the raw tree. This means:

- Expanding a parent increases the visible row count
- Page size applies to the flattened visible list

---

## Infinite Scroll (DataTableInfinite)

`DataTableInfinite` does **not** use pagination. Instead, it uses these mechanisms:

### Auto-load on Scroll

```ts
const onScroll = (e) => {
  const atBottom =
    Math.ceil(e.currentTarget.scrollTop + e.currentTarget.clientHeight) >=
    e.currentTarget.scrollHeight;
  if (atBottom && !isFetching && totalRowsFetched < filterRows) {
    fetchNextPage();
  }
};
```

### "Load More" Button

A fallback button at the bottom of the table:

```tsx
<Button onClick={() => fetchNextPage()} disabled={isFetching}>
  Load More
</Button>
```

### Row Count Display

The bottom of the table shows:

```
No more data to load (1,234 of 5,678 rows)
```

### Required Props for Infinite Scroll

| Prop               | Type                 | Description              |
| ------------------ | -------------------- | ------------------------ |
| `fetchNextPage`    | `(opts?) => Promise` | Load next page           |
| `hasNextPage`      | `boolean`            | More data available      |
| `totalRows`        | `number`             | Total DB row count       |
| `filterRows`       | `number`             | Filtered row count       |
| `totalRowsFetched` | `number`             | How many rows are loaded |
| `isFetching`       | `boolean`            | Currently loading        |
| `refetch`          | `(opts?) => void`    | Refetch all data         |

### Integration with `useInfiniteQuery`

```tsx
const { data, fetchNextPage, hasNextPage, isFetching, isLoading, refetch } =
  useInfiniteQuery(dataOptions(search));

const flatData = data?.pages?.flatMap((page) => page.data ?? []) ?? [];
const lastPage = data?.pages?.[data.pages.length - 1];

<DataTableInfinite
  data={flatData}
  fetchNextPage={fetchNextPage}
  hasNextPage={hasNextPage}
  totalRows={lastPage?.meta?.totalRowCount}
  filterRows={lastPage?.meta?.filterRowCount}
  totalRowsFetched={flatData.length}
  isFetching={isFetching}
  isLoading={isLoading}
  refetch={refetch}
/>;
```
