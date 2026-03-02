"use client";

// REMINDER: React Compiler is not compatible with TanStack Table v8
// https://github.com/TanStack/table/issues/5567
"use no memo";

import {DataTableFilterCommand} from "@/components/data-table/data-table-filter-command/index";
import {DataTableFilterControls} from "@/components/data-table/data-table-filter-controls";
import {DataTablePagination} from "@/components/data-table/data-table-pagination";
import {DataTableProvider} from "@/components/data-table/data-table-provider";
import {DataTableToolbar} from "@/components/data-table/data-table-toolbar";
import type {DataTableFilterField,SheetField} from "@/components/data-table/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {useLocalStorage} from "@/hooks/use-local-storage";
import {getColumnVisibilityKey} from "@/lib/constants/local-storage";
import type {SchemaDefinition} from "@/lib/store/schema/schemaTypes";
import {cn} from "@/lib/utils";
import type {FetchNextPageOptions,FetchPreviousPageOptions,RefetchOptions} from "@tanstack/react-query";
import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
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
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

/**
 * DataTableTreeProps extends the full infinite-capable props interface but makes
 * fetchNextPage / refetch / meta optional — tree tables work with static data.
 * Pass those props to enable infinite-scroll or manual-pagination in a tree table.
 */
export interface DataTableTreeProps<TData,TValue,TMeta=Record<string,unknown>> {
  // ── Core ──────────────────────────────────────────────────────────────────
  data: TData[];
  columns: ColumnDef<TData,TValue>[];
  filterFields?: DataTableFilterField<TData>[];
  schema: SchemaDefinition;
  tableId: string;

  // ── Tree-specific ─────────────────────────────────────────────────────────
  /** Return the children for a given row. Defaults to `(row) => (row as any).children`. */
  getSubRows?: (row: TData) => TData[]|undefined;
  /** Keep ancestor rows visible when any descendant matches. Defaults to true. */
  filterFromLeafRows?: boolean;

  // ── State defaults ────────────────────────────────────────────────────────
  defaultColumnFilters?: ColumnFiltersState;
  defaultSorting?: SortingState;
  defaultColumnVisibility?: VisibilityState;
  defaultRowSelection?: RowSelectionState;
  defaultPagination?: PaginationState;

  // ── Row behaviour ─────────────────────────────────────────────────────────
  getRowId?: TableOptions<TData>["getRowId"];
  getRowClassName?: (row: Row<TData>) => string;

  // ── Server-side facets ────────────────────────────────────────────────────
  getFacetedUniqueValues?: (table: TTable<TData>,columnId: string) => Map<string,number>;
  getFacetedMinMaxValues?: (table: TTable<TData>,columnId: string) => [number,number]|undefined;

  // ── Column features ───────────────────────────────────────────────────────
  enableColumnOrdering?: boolean;
  enableColumnResizing?: boolean;

  // ── Loading / fetch state ─────────────────────────────────────────────────
  isLoading?: boolean;
  isFetching?: boolean;
  totalRows?: number;
  filterRows?: number;
  totalRowsFetched?: number;

  // ── Infinite scroll support (optional — enables scrolling in tree tables) ─
  hasNextPage?: boolean;
  fetchNextPage?: (options?: FetchNextPageOptions) => Promise<unknown>;
  fetchPreviousPage?: (options?: FetchPreviousPageOptions) => Promise<unknown>;
  refetch?: (options?: RefetchOptions) => void;
  meta?: TMeta;

  // ── Sheet / detail panel ──────────────────────────────────────────────────
  sheetFields?: SheetField<TData>[];
  renderSheetTitle?: (props: {row?: Row<TData>}) => React.ReactNode;

  // ── Render slots ──────────────────────────────────────────────────────────
  renderActions?: () => React.ReactNode;
  renderChart?: () => React.ReactNode;
  renderSidebarFooter?: () => React.ReactNode;
}

export function DataTableTree<TData,TValue,TMeta=Record<string,unknown>>({
  columns,
  data,
  defaultColumnFilters=[],
  defaultSorting=[],
  defaultColumnVisibility={},
  defaultPagination={pageIndex: 0,pageSize: 10},
  filterFields=[],
  getFacetedUniqueValues: externalGetFacetedUniqueValues,
  getFacetedMinMaxValues: externalGetFacetedMinMaxValues,
  getSubRows,
  filterFromLeafRows=true,
  isLoading,
  schema,
  tableId,
  renderActions,
  renderChart,
  renderSidebarFooter,
}: DataTableTreeProps<TData,TValue,TMeta>) {
  const [columnFilters,setColumnFilters]=
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting,setSorting]=
    React.useState<SortingState>(defaultSorting);
  const [pagination,setPagination]=
    React.useState<PaginationState>(defaultPagination);
  const [expanded,setExpanded]=React.useState<ExpandedState>({});
  const [columnVisibility,setColumnVisibility]=
    useLocalStorage<VisibilityState>(
      getColumnVisibilityKey(tableId),
      defaultColumnVisibility,
    );

  // Reset pagination to page 0 when filters change
  React.useEffect(() => {
    setPagination((prev) => ({...prev,pageIndex: 0}));
  },[columnFilters]);

  // Custom getFacetedUniqueValues that handles array values
  const customGetFacetedUniqueValues=React.useCallback(
    (table: TTable<TData>,columnId: string) => () => {
      const facets=getFacetedUniqueValues<TData>()(table,columnId)();
      const customFacets=new Map();
      for (const [key,value] of facets as Map<unknown,number>) {
        if (Array.isArray(key)) {
          for (const k of key) {
            customFacets.set(k,(customFacets.get(k)||0)+value);
          }
        } else {
          customFacets.set(key,(customFacets.get(key)||0)+value);
        }
      }
      return customFacets;
    },
    [],
  );

  const table=useReactTable({
    data,
    columns,
    state: {columnFilters,sorting,columnVisibility,pagination,expanded},
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    // ── Tree options ──────────────────────────────────────────────────────────
    getSubRows: getSubRows??((row) => (row as Record<string,unknown>).children as TData[]|undefined),
    filterFromLeafRows,
    getExpandedRowModel: getExpandedRowModel(),
    // ── Standard row models ───────────────────────────────────────────────────
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: customGetFacetedUniqueValues,
    enableFilters: true,
    enableColumnFilters: true,
  });

  const getFacetedUniqueValuesForProvider=React.useCallback(
    (table: TTable<TData>,columnId: string): Map<string,number> => {
      if (externalGetFacetedUniqueValues) {
        return externalGetFacetedUniqueValues(table,columnId);
      }
      return customGetFacetedUniqueValues(table,columnId)();
    },
    [customGetFacetedUniqueValues,externalGetFacetedUniqueValues],
  );

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      pagination={pagination}
      isLoading={isLoading}
      getFacetedUniqueValues={getFacetedUniqueValuesForProvider}
      getFacetedMinMaxValues={externalGetFacetedMinMaxValues}
    >
      <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "hidden w-full p-1 sm:block sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-64 md:max-w-64",
            "group-data-[expanded=false]/controls:hidden",
          )}
        >
          <DataTableFilterControls />
          {renderSidebarFooter?.()}
        </div>
        <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
          <DataTableFilterCommand schema={schema} tableId={tableId} />
          {renderChart?.()}
          <DataTableToolbar renderActions={renderActions} />
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          :flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected()&&"selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ):(
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination />
        </div>
      </div>
    </DataTableProvider>
  );
}
