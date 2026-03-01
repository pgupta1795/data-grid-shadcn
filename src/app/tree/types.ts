export type VPMInstance = {
  id: string;
  name: string;
  type: "VPMInstance";
  created: Date;
  modified: Date;
  cestamp?: string;
};

export type TreeNode = {
  id: string;
  title: string;
  name: string;
  type: "VPMReference" | "VPMInstance";
  state: string;
  revision: string;
  organization: string;
  owner: string;
  created: Date;
  modified: Date;
  collabspace: string;
  description?: string;
  cestamp?: string;
  instances: VPMInstance[];
  instancesCount: number; // computed from instances.length
  children: TreeNode[];
};
