import {createSchema,field} from "@/lib/store/schema/schema";

export const filterSchema=createSchema({
  // Text input filters
  title: field.string(),
  name: field.string(),

  // Checkbox filters — multi-select arrays of string
  state: field.array(field.string()).delimiter(","),
  type: field.array(field.string()).delimiter(","),
  revision: field.array(field.string()).delimiter(","),
  collabspace: field.array(field.string()).delimiter(","),

  // Slider filter — numeric range [min, max]
  instancesCount: field.array(field.number()).delimiter("-"),

  // Date range filter — [start, end] timestamps
  modified: field.array(field.timestamp()).delimiter("-"),

  // Sort state
  sort: field.sort(),
});

export type FilterState=typeof filterSchema._type;
