"use client";

// REMINDER: React Compiler is not compatible with TanStack Table v8
// https://github.com/TanStack/table/issues/5567
"use no memo";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { DataTableFilterCommand } from "@/components/data-table/data-table-filter-command";
import { DataTableFilterControls } from "@/components/data-table/data-table-filter-controls";
import { DataTableProvider } from "@/components/data-table/data-table-provider";
import { DataTableResetButton } from "@/components/data-table/data-table-reset-button";
import { MemoizedDataTableSheetContent } from "@/components/data-table/data-table-sheet/data-table-sheet-content";
import { DataTableSheetDetails } from "@/components/data-table/data-table-sheet/data-table-sheet-details";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { BaseChartSchema, DataTableFilterField, SheetField } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { useHotKey } from "@/hooks/use-hot-key";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  getColumnOrderKey,
  getColumnVisibilityKey,
} from "@/lib/constants/local-storage";
import { formatCompactNumber } from "@/lib/format";
import type { SchemaDefinition } from "@/lib/store/schema/types";
import { useFilterState } from "@/lib/store";
import { arrSome, inDateRange } from "@/lib/table/filterfns";
import { cn } from "@/lib/utils";
import type {
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  RefetchOptions,
} from "@tanstack/react-query";
import type {
  ColumnDef,
  ColumnFiltersState,
  Row,
  RowSelectionState,
  SortingState,
  TableOptions,
  Table as TTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues as getTTableFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues as getTTableFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { LoaderCircle } from "lucide-react";
import * as React from "react";

export interface DataTableInfiniteProps<TData, TValue, TMeta> {
  // ── Core ──────────────────────────────────────────────────────────────────
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  schema: SchemaDefinition;
  tableId?: string;

  // ── Required scroll props ─────────────────────────────────────────────────
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<unknown>;
  refetch: (options?: RefetchOptions) => void;
  meta: TMeta;

  // ── State defaults ────────────────────────────────────────────────────────
  defaultColumnFilters?: ColumnFiltersState;
  defaultColumnSorting?: SortingState;
  defaultRowSelection?: RowSelectionState;
  defaultColumnVisibility?: VisibilityState;

  // ── Filter / facet ────────────────────────────────────────────────────────
  filterFields?: DataTableFilterField<TData>[];
  sheetFields?: SheetField<TData, TMeta>[];
  getFacetedUniqueValues?: (table: TTable<TData>, columnId: string) => Map<string, number>;
  getFacetedMinMaxValues?: (table: TTable<TData>, columnId: string) => [number, number] | undefined;

  // ── Row options ───────────────────────────────────────────────────────────
  getRowClassName?: (row: Row<TData>) => string;
  getRowId?: TableOptions<TData>["getRowId"];

  // ── Counts / loading ──────────────────────────────────────────────────────
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;
  isFetching?: boolean;
  isLoading?: boolean;
  hasNextPage?: boolean;
  fetchPreviousPage?: (options?: FetchPreviousPageOptions) => Promise<unknown>;

  // ── Chart ─────────────────────────────────────────────────────────────────
  /** @deprecated Use renderChart instead. Kept for backwards compatibility. */
  chartData?: BaseChartSchema[];
  chartDataColumnId?: string;

  // ── Render slots ──────────────────────────────────────────────────────────
  renderLiveRow?: (props?: { row: Row<TData> }) => React.ReactNode;
  renderSheetTitle: (props: { row?: Row<TData> }) => React.ReactNode;
  /** Renders below the command bar, above the table header */
  renderChart?: () => React.ReactNode;
  /** Passed to DataTableToolbar — renders after reset button, before view options */
  renderActions?: () => React.ReactNode;
  /** Renders at the bottom of the sidebar */
  renderSidebarFooter?: () => React.ReactNode;
}

export function DataTableInfinite<TData, TValue, TMeta>({
  columns,
  getRowClassName,
  getRowId,
  data,
  defaultColumnFilters = [],
  defaultColumnSorting = [],
  defaultRowSelection = {},
  defaultColumnVisibility = {},
  filterFields = [],
  sheetFields = [],
  isFetching,
  isLoading,
  fetchNextPage,
  hasNextPage,
  fetchPreviousPage,
  refetch,
  totalRows = 0,
  filterRows = 0,
  totalRowsFetched = 0,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  meta,
  renderLiveRow,
  renderSheetTitle,
  renderChart,
  renderActions,
  renderSidebarFooter,
  schema,
  tableId = "infinite",
}: DataTableInfiniteProps<TData, TValue, TMeta>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] =
    React.useState<SortingState>(defaultColumnSorting);
  const [rowSelection, setRowSelection] =
    React.useState<RowSelectionState>(defaultRowSelection);
  const [columnOrder, setColumnOrder] = useLocalStorage<string[]>(
    getColumnOrderKey(tableId),
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>(
      getColumnVisibilityKey(tableId),
      defaultColumnVisibility,
    );
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [topBarHeight, setTopBarHeight] = React.useState(0);

  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const onPageBottom =
        Math.ceil(e.currentTarget.scrollTop + e.currentTarget.clientHeight) >=
        e.currentTarget.scrollHeight;
      if (onPageBottom && !isFetching && totalRowsFetched < filterRows) {
        fetchNextPage();
      }
    },
    [fetchNextPage, isFetching, filterRows, totalRowsFetched],
  );

  React.useEffect(() => {
    const observer = new ResizeObserver(() => {
      const rect = topBarRef.current?.getBoundingClientRect();
      if (rect) setTopBarHeight(rect.height);
    });
    const topBar = topBarRef.current;
    if (!topBar) return;
    observer.observe(topBar);
    return () => observer.unobserve(topBar);
  }, [topBarRef]);

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, columnVisibility, rowSelection, columnOrder },
    enableMultiRowSelection: false,
    columnResizeMode: "onChange",
    getRowId,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getTTableFacetedUniqueValues(),
    getFacetedMinMaxValues: getTTableFacetedMinMaxValues(),
    filterFns: { inDateRange, arrSome },
    debugAll: process.env.NEXT_PUBLIC_TABLE_DEBUG === "true",
    meta: { getRowClassName },
  });

  const selectedRow = React.useMemo(() => {
    if ((isLoading || isFetching) && !data.length) return;
    const selectedRowKey = Object.keys(rowSelection)?.[0];
    return table.getCoreRowModel().flatRows.find((row) => row.id === selectedRowKey);
  }, [rowSelection, table, isLoading, isFetching, data]);

  React.useEffect(() => {
    if (isLoading || isFetching) return;
    if (Object.keys(rowSelection)?.length && !selectedRow) {
      setRowSelection({});
    }
  }, [rowSelection, selectedRow, isLoading, isFetching]);

  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: string } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id.replace(".", "-")}-size`] = `${header.getSize()}px`;
      colSizes[`--col-${header.column.id.replace(".", "-")}-size`] = `${header.column.getSize()}px`;
    }
    return colSizes;
  }, [
    table.getState().columnSizingInfo,
    table.getState().columnSizing,
    table.getState().columnVisibility,
  ]);

  useHotKey(() => {
    setColumnOrder([]);
    setColumnVisibility(defaultColumnVisibility);
  }, "u");

  const visibleColumnIds = React.useMemo(
    () => table.getVisibleLeafColumns().map((c) => c.id).join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getState().columnVisibility],
  );
  const columnOrderString = React.useMemo(() => columnOrder.join(","), [columnOrder]);

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      rowSelection={rowSelection}
      columnOrder={columnOrder}
      columnVisibility={columnVisibility}
      enableColumnOrdering={true}
      isLoading={isFetching || isLoading}
      getFacetedUniqueValues={getFacetedUniqueValues}
      getFacetedMinMaxValues={getFacetedMinMaxValues}
    >
      <div
        className="flex h-full min-h-screen w-full flex-col sm:flex-row"
        style={
          {
            "--top-bar-height": `${topBarHeight}px`,
            ...columnSizeVars,
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "h-full w-full flex-col sm:sticky sm:top-0 sm:max-h-screen sm:min-h-screen sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-72 md:max-w-72",
            "group-data-[expanded=false]/controls:hidden",
            "hidden sm:flex",
          )}
        >
          <div className="border-b border-border bg-background p-2 md:sticky md:top-0">
            <div className="flex h-[46px] items-center justify-between gap-3">
              <p className="px-2 font-medium text-foreground">Filters</p>
              <div>
                {table.getState().columnFilters.length ? <DataTableResetButton /> : null}
              </div>
            </div>
          </div>
          <div className="flex-1 p-2 sm:overflow-y-scroll">
            <DataTableFilterControls />
          </div>
          {renderSidebarFooter && (
            <div className="border-t border-border bg-background p-4 md:sticky md:bottom-0">
              {renderSidebarFooter()}
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex max-w-full flex-1 flex-col border-border sm:border-l",
            "group-data-[expanded=true]/controls:sm:max-w-[calc(100vw_-_208px)] group-data-[expanded=true]/controls:md:max-w-[calc(100vw_-_288px)]",
          )}
        >
          <div
            ref={topBarRef}
            className={cn(
              "flex flex-col gap-4 bg-background p-2",
              "sticky top-0 z-10 pb-4",
            )}
          >
            <DataTableFilterCommand schema={schema} tableId={tableId} />
            <DataTableToolbar renderActions={renderActions} />
            {renderChart?.()}
          </div>
          <div className="z-0">
            <Table
              ref={tableRef}
              onScroll={onScroll}
              className="border-separate border-spacing-0"
              containerClassName="max-h-[calc(100vh_-_var(--top-bar-height))]"
            >
              <TableHeader className={cn("sticky top-0 z-20 bg-background")}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className={cn(
                      "bg-muted/50 hover:bg-muted/50",
                      "[&>*]:border-t [&>:not(:last-child)]:border-r",
                    )}
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "relative select-none truncate border-b border-border [&>.cursor-col-resize]:last:opacity-0",
                          header.column.columnDef.meta?.headerClassName,
                        )}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : "none"
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() && (
                          <div
                            onDoubleClick={() => header.column.resetSize()}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "user-select-none absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none justify-center",
                              "before:absolute before:inset-y-0 before:w-px before:translate-x-px before:bg-border",
                            )}
                          />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody
                id="content"
                tabIndex={-1}
                className="outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:outline"
                style={{ scrollMarginTop: "calc(var(--top-bar-height) + 40px)" }}
              >
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                      {renderLiveRow?.({ row })}
                      <MemoizedRow
                        row={row}
                        table={table}
                        selected={row.getIsSelected()}
                        visibleColumnIds={visibleColumnIds}
                        columnOrder={columnOrderString}
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <React.Fragment>
                    {renderLiveRow?.()}
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results.
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )}
                <TableRow className="hover:bg-transparent data-[state=selected]:bg-transparent">
                  <TableCell colSpan={columns.length} className="text-center">
                    {hasNextPage || isFetching || isLoading ? (
                      <Button
                        disabled={isFetching || isLoading}
                        onClick={() => fetchNextPage()}
                        size="sm"
                        variant="outline"
                      >
                        {isFetching ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Load More
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No more data to load (
                        <span className="font-mono font-medium">
                          {formatCompactNumber(filterRows)}
                        </span>{" "}
                        of{" "}
                        <span className="font-mono font-medium">
                          {formatCompactNumber(totalRows)}
                        </span>{" "}
                        rows)
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      <DataTableSheetDetails
        title={renderSheetTitle({ row: selectedRow })}
        titleClassName="font-mono"
      >
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
      </DataTableSheetDetails>
    </DataTableProvider>
  );
}

function Row<TData>({
  row,
  table,
  selected,
  visibleColumnIds,
  columnOrder,
}: {
  row: Row<TData>;
  table: TTable<TData>;
  selected?: boolean;
  visibleColumnIds: string;
  columnOrder: string;
}) {
  useFilterState((s: Record<string, unknown>) => s.live);
  return (
    <TableRow
      id={row.id}
      tabIndex={0}
      data-state={selected && "selected"}
      onClick={() => row.toggleSelected()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          row.toggleSelected();
        }
      }}
      className={cn(
        "[&>:not(:last-child)]:border-r",
        "outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:bg-muted/50 focus-visible:outline data-[state=selected]:outline",
        table.options.meta?.getRowClassName?.(row),
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            "truncate border-b border-border",
            cell.column.columnDef.meta?.cellClassName,
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

const MemoizedRow = React.memo(
  Row,
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.selected === next.selected &&
    prev.visibleColumnIds === next.visibleColumnIds &&
    prev.columnOrder === next.columnOrder,
) as typeof Row;
