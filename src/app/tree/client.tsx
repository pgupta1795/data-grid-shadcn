"use client";

import { DataTableStoreProvider, type AdapterType } from "@/lib/store";
import { useNuqsAdapter } from "@/lib/store/adapters/nuqs";
import { useZustandAdapter } from "@/lib/store/adapters/zustand";
import * as React from "react";
import { columns } from "./columns";
import { filterFields } from "./constants";
import { DataTable } from "./data-table";
import { treeData } from "./data";
import { filterSchema } from "./schema";
import { useFilterStore } from "./store";

interface ClientProps {
  defaultAdapterType?: AdapterType;
}

export function Client({ defaultAdapterType = "nuqs" }: ClientProps) {
  return (
    <React.Fragment>
      {defaultAdapterType === "nuqs" ? <NuqsClient /> : <ZustandClient />}
    </React.Fragment>
  );
}

function NuqsClient() {
  const adapter = useNuqsAdapter(filterSchema.definition, { id: "tree" });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable
        columns={columns}
        data={treeData}
        filterFields={filterFields}
      />
    </DataTableStoreProvider>
  );
}

function ZustandClient() {
  const adapter = useZustandAdapter(useFilterStore, filterSchema.definition, {
    id: "tree",
  });
  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTable
        columns={columns}
        data={treeData}
        filterFields={filterFields}
      />
    </DataTableStoreProvider>
  );
}
