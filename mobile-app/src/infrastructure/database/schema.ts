import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const technicalHealthChecks = sqliteTable('technical_health_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bootVersion: text('boot_version').notNull(),
  createdAt: integer('created_at').notNull() // Unix ms
});
