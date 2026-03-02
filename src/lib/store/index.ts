/**
 * BYOS (Bring Your Own Store) - Main Exports
 *
 * This module provides a pluggable state management system for data tables.
 *
 * @example
 * ```typescript
 * // 1. Define schema
 * import { createSchema, field } from '@/lib/store';
 *
 * const schema = createSchema({
 *   regions: field.array(field.string()).default([]).delimiter(','),
 *   latency: field.array(field.number()).delimiter('-'),
 *   host: field.string(),
 *   live: field.boolean().default(false),
 * });
 *
 * // 2. Create adapter (nuqs for URL state)
 * import { useNuqsAdapter } from '@/lib/store/adapters/nuqs';
 *
 * const adapter = useNuqsAdapter(schema.definition, { id: 'my-table' });
 *
 * // 3. Use in component
 * import { DataTableStoreProvider, useFilterState, useFilterActions } from '@/lib/store';
 *
 * function MyTable() {
 *   return (
 *     <DataTableStoreProvider adapter={adapter}>
 *       <FilterControls />
 *       <DataTable />
 *     </DataTableStoreProvider>
 *   );
 * }
 *
 * function FilterControls() {
 *   const state = useFilterState();
 *   const { setFilter, resetAllFilters } = useFilterActions();
 *   // ...
 * }
 * ```
 */

// Schema
export {createSchema,field,getSchemaDefaults,isStateEqual,mergeWithDefaults,parseState,serializeState,stateToSearchString,validateState} from "./schema/schema";
export type {
  AdapterOptions,FieldBuilder,
  FieldConfig,InferSchemaType,Schema,
  SchemaDefinition,StoreSnapshot
} from "./schema/schema";

// Adapter Interface
export type {
  AdapterFactory,
  AdapterType,CreateAdapterOptions,StoreAdapter
} from "./adapter/adapterTypes";

// Provider
export {DataTableStoreProvider} from "./provider/DataTableStoreProvider";
export type {DataTableStoreProviderProps} from "./provider/DataTableStoreProvider";

// Hooks
export {useFilterActions,type FilterActions} from "./hooks/useFilterActions";
export {useFilterField,type FilterFieldResult} from "./hooks/useFilterField";
export {useFilterState} from "./hooks/useFilterState";
export {useReactTableSync} from "./hooks/useReactTableSync";

// Context (for advanced use cases)
export {
  StoreContext,
  useStoreContext,
  type StoreContextValue
} from "./context";

// Text Parser
export {createTextParser} from "./parser/text-parser";
export type {TextParser,TextParserOptions} from "./parser/types";

