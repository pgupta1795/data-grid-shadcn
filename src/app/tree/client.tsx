"use client";

import { DataTableTree } from "@/components/data-table/data-table-tree";
import { DataTableStoreProvider } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { treeData } from "./data";
import { filterSchema } from "./schema";

export function Client() {
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
