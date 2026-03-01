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
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableProvider } from "@/components/data-table/data-table-provider";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { DataTableFilterField } from "@/components/data-table/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getColumnVisibilityKey } from "@/lib/constants/local-storage";
import { cn } from "@/lib/utils";
import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  SortingState,
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
import { filterSchema } from "./schema";
import type { TreeNode } from "./types";

export interface DataTableProps {
  columns: ColumnDef<TreeNode>[];
  data: TreeNode[];
  defaultColumnFilters?: ColumnFiltersState;
  filterFields?: DataTableFilterField<TreeNode>[];
  tableId?: string;
}

export function DataTable({
  columns,
  data,
  defaultColumnFilters = [],
  filterFields = [],
  tableId = "tree",
}: DataTableProps) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>(getColumnVisibilityKey(tableId), {});

  // Reset pagination to page 0 when filters change
  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  // Custom getFacetedUniqueValues that handles array values
  // (same implementation as default/data-table.tsx)
  const customGetFacetedUniqueValues = React.useCallback(
    (table: TTable<TreeNode>, columnId: string) => () => {
      const facets = getFacetedUniqueValues<TreeNode>()(table, columnId)();
      const customFacets = new Map();
      for (const [key, value] of facets as Map<unknown, number>) {
        if (Array.isArray(key)) {
          for (const k of key) {
            const prevValue = customFacets.get(k) || 0;
            customFacets.set(k, prevValue + value);
          }
        } else {
          const prevValue = customFacets.get(key) || 0;
          customFacets.set(key, prevValue + value);
        }
      }
      return customFacets;
    },
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
      expanded,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    // ── Tree-specific options ──────────────────────────────────────────────
    // Tell TanStack where to find each row's children
    getSubRows: (row) => row.children,
    // Keep ancestor rows visible when any descendant matches a filter
    filterFromLeafRows: true,
    // Enable the expand/collapse row model
    getExpandedRowModel: getExpandedRowModel(),
    // ── Standard row models (unchanged from default route) ─────────────────
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

  // Wrap signature for DataTableProvider (needs Map<string,number>, not function)
  const getFacetedUniqueValuesForProvider = React.useCallback(
    (table: TTable<TreeNode>, columnId: string): Map<string, number> => {
      return customGetFacetedUniqueValues(table, columnId)();
    },
    [customGetFacetedUniqueValues],
  );

  return (
    <DataTableProvider
      table={table}
      columns={columns}
      filterFields={filterFields}
      columnFilters={columnFilters}
      sorting={sorting}
      pagination={pagination}
      getFacetedUniqueValues={getFacetedUniqueValuesForProvider}
    >
      <div className="flex h-full w-full flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "hidden w-full p-1 sm:block sm:min-w-52 sm:max-w-52 sm:self-start md:min-w-64 md:max-w-64",
            "group-data-[expanded=false]/controls:hidden",
          )}
        >
          <DataTableFilterControls />
        </div>
        <div className="flex max-w-full flex-1 flex-col gap-4 overflow-hidden p-1">
          <DataTableFilterCommand
            schema={filterSchema.definition}
            tableId="tree"
          />
          <DataTableToolbar />
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
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
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
                ) : (
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
