"use client";

import type { DataTableFilterField } from "@/components/data-table/types";
import { flattenTree, treeData } from "./data";
import type { TreeNode } from "./types";

// Pre-compute unique filter option values from the full tree at module load
const allNodes = flattenTree(treeData);

const uniqueStates = [...new Set(allNodes.map((n) => n.state))].filter(Boolean);
const uniqueTypes = [...new Set(allNodes.map((n) => n.type))].filter(Boolean);
const uniqueRevisions = [...new Set(allNodes.map((n) => n.revision))].filter(
  Boolean,
);
const uniqueCollabspaces = [
  ...new Set(allNodes.map((n) => n.collabspace)),
].filter(Boolean);

const instanceCounts = allNodes.map((n) => n.instances.length);
const maxInstancesCount = Math.max(...instanceCounts, 0);

export const filterFields = [
  {
    label: "Modified",
    value: "modified",
    type: "timerange",
    defaultOpen: true,
    commandDisabled: true,
  },
  {
    label: "Title",
    value: "title",
    type: "input",
    options: allNodes.map(({ title }) => ({ label: title, value: title })),
  },
  {
    label: "Name",
    value: "name",
    type: "input",
    options: allNodes.map(({ name }) => ({ label: name, value: name })),
  },
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
    label: "Revision",
    value: "revision",
    type: "checkbox",
    options: uniqueRevisions.map((r) => ({ label: r, value: r })),
  },
  {
    label: "Collabspace",
    value: "collabspace",
    type: "checkbox",
    options: uniqueCollabspaces.map((c) => ({ label: c, value: c })),
  },
  {
    label: "Instances",
    value: "instancesCount",
    type: "slider",
    min: 0,
    max: maxInstancesCount,
    options: instanceCounts.map((count) => ({
      label: `${count}`,
      value: count,
    })),
    defaultOpen: true,
  },
] satisfies DataTableFilterField<TreeNode>[];
