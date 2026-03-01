"use client";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { isArrayOfDates, isArrayOfNumbers } from "@/lib/is-array";
import type { ColumnDef } from "@tanstack/react-table";
import { format, isSameDay } from "date-fns";
import { ChevronDown, ChevronRight, Minus } from "lucide-react";
import type { TreeNode } from "./types";

export const columns: ColumnDef<TreeNode>[] = [
  {
    accessorKey: "title",
    header: "Title",
    enableHiding: false,
    cell: ({ row }) => {
      const canExpand = row.getCanExpand();
      const isExpanded = row.getIsExpanded();
      return (
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${row.depth * 16}px` }}
        >
          {canExpand ? (
            <button
              onClick={row.getToggleExpandedHandler()}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{row.getValue("title")}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (typeof value === "string")
        return rowValue.toLowerCase().includes(value.toLowerCase());
      return false;
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (typeof value === "string")
        return rowValue.toLowerCase().includes(value.toLowerCase());
      return false;
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const value = row.getValue("type") as string;
      return (
        <Badge variant="outline" className="font-mono text-xs">
          {value}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => {
      const value = row.getValue("state") as string;
      const variant =
        value === "IN_WORK"
          ? "secondary"
          : value === "FROZEN"
            ? "default"
            : "outline";
      return <Badge variant={variant}>{value}</Badge>;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    accessorKey: "revision",
    header: "Revision",
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    accessorKey: "organization",
    header: "Organization",
  },
  {
    accessorKey: "collabspace",
    header: "Collabspace",
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string;
      if (Array.isArray(value)) return value.includes(rowValue);
      return value === rowValue;
    },
  },
  {
    accessorKey: "instancesCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Instances" />
    ),
    cell: ({ row }) => {
      const count = row.getValue("instancesCount") as number;
      if (count === 0)
        return <Minus className="h-4 w-4 text-muted-foreground/50" />;
      return <span className="font-mono">{count}</span>;
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as number;
      if (typeof value === "number") return value === rowValue;
      if (Array.isArray(value) && isArrayOfNumbers(value)) {
        if (value.length === 1) return value[0] === rowValue;
        const sorted = [...value].sort((a, b) => a - b);
        return sorted[0] <= rowValue && rowValue <= sorted[1];
      }
      return false;
    },
  },
  {
    accessorKey: "modified",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Modified" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("modified");
      return (
        <div className="text-xs text-muted-foreground" suppressHydrationWarning>
          {format(new Date(`${value}`), "LLL dd, y HH:mm")}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id);
      if (value instanceof Date && rowValue instanceof Date) {
        return isSameDay(value, rowValue);
      }
      if (Array.isArray(value)) {
        if (isArrayOfDates(value) && rowValue instanceof Date) {
          const sorted = [...value].sort((a, b) => a.getTime() - b.getTime());
          return (
            sorted[0]?.getTime() <= rowValue.getTime() &&
            rowValue.getTime() <= sorted[1]?.getTime()
          );
        }
      }
      return false;
    },
  },
];
