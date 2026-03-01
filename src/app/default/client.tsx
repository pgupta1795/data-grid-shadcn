"use client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableStoreProvider } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { data } from "./data";
import { filterSchema } from "./schema";

export function Client() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "default" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable
        columns={columns}
        data={data}
        filterFields={filterFields}
        schema={filterSchema.definition}
        tableId="default"
      />
    </DataTableStoreProvider>
  );
}
