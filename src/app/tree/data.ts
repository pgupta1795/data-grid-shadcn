import rawData from "../../../ChildrenData.json";
import type { TreeNode, VPMInstance } from "./types";

function transformInstance(raw: Record<string, unknown>): VPMInstance {
  return {
    id: raw.id as string,
    name: raw.name as string,
    type: "VPMInstance",
    created: new Date(raw.created as string),
    modified: new Date(raw.modified as string),
    cestamp: raw.cestamp as string | undefined,
  };
}

function transformNode(raw: Record<string, unknown>): TreeNode {
  return {
    id: raw.id as string,
    title: raw.title as string,
    name: raw.name as string,
    type: raw.type as "VPMReference" | "VPMInstance",
    state: (raw.state as string) ?? "UNKNOWN",
    revision: (raw.revision as string) ?? "",
    organization: (raw.organization as string) ?? "",
    owner: (raw.owner as string) ?? "",
    created: new Date(raw.created as string),
    modified: new Date(raw.modified as string),
    collabspace: (raw.collabspace as string) ?? "",
    description: raw.description as string | undefined,
    cestamp: raw.cestamp as string | undefined,
    instances: ((raw.instances as unknown[]) ?? []).map((i) =>
      transformInstance(i as Record<string, unknown>),
    ),
    instancesCount: ((raw.instances as unknown[]) ?? []).length,
    children: ((raw.children as unknown[]) ?? []).map((c) =>
      transformNode(c as Record<string, unknown>),
    ),
  };
}

// Root is a single node — wrap in array so TanStack Table receives TreeNode[]
export const treeData: TreeNode[] = [
  transformNode(rawData as Record<string, unknown>),
];

// Flatten entire tree into a flat array — used to build filter options
export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}
