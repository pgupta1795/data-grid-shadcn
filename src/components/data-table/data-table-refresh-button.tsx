"use client";

import { useDataTable } from "@/components/data-table/data-table-provider";
import { Button } from "@/components/ui/button";
import { LoaderCircle, RefreshCcw } from "lucide-react";

interface DataTableRefreshButtonProps {
  onClick: () => void;
}

export function DataTableRefreshButton({ onClick }: DataTableRefreshButtonProps) {
  const { isLoading } = useDataTable();

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={isLoading}
      onClick={onClick}
      className="h-9 w-9"
    >
      {isLoading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}
      <span className="sr-only">Refresh data</span>
    </Button>
  );
}
