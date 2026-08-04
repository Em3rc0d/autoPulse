import { sqliteTable, text, integer, unique, real } from 'drizzle-orm/sqlite-core';

export const obdParameterDefinitions = sqliteTable('obd_parameter_definitions', {
  id: text('id').primaryKey(),
  namespace: text('namespace').notNull(),
  service: integer('service').notNull(),
  parameterIdentifier: integer('parameter_identifier').notNull(),
  technicalName: text('technical_name').notNull(),
  capabilityRange: text('capability_range'),
  requestVersion: text('request_version').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  namespaceServicePidIdx: unique('uq_obd_parameter_def').on(table.namespace, table.service, table.parameterIdentifier)
}));

export const signalDefinitions = sqliteTable('signal_definitions', {
  id: text('id').primaryKey(),
  parameterDefinitionId: text('parameter_definition_id').notNull().references(() => obdParameterDefinitions.id, { onDelete: 'restrict' }),
  signalKey: text('signal_key').notNull(),
  name: text('name').notNull(),
  canonicalUnit: text('canonical_unit'),
  numericType: text('numeric_type').notNull(),
  decoderKey: text('decoder_key').notNull(),
  decoderVersion: text('decoder_version').notNull(),
  scale: real('scale').notNull().default(1),
  offset: real('offset').notNull().default(0),
  precision: integer('precision').notNull().default(0),
  defaultPriority: text('default_priority').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  paramDecoderIdx: unique('uq_signal_def').on(table.parameterDefinitionId, table.signalKey, table.decoderVersion)
}));
