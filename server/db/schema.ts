import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  status: text('status').notNull().default('draft'),
  currentPlanVersion: integer('current_plan_version').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const nodes = sqliteTable('nodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  planVersion: integer('plan_version').notNull(),
  nodeKey: text('node_key').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  spec: text('spec').notNull(),
  status: text('status').notNull().default('pending'),
  order: integer('node_order').notNull(),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const edges = sqliteTable('edges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  planVersion: integer('plan_version').notNull(),
  sourceKey: text('source_key').notNull(),
  targetKey: text('target_key').notNull(),
})

export const decisions = sqliteTable('decisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  nodeId: integer('node_id'),
  gate: text('gate').notNull(),
  decision: text('decision').notNull(),
  comment: text('comment'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type PlanNodeRow = typeof nodes.$inferSelect
export type PlanEdgeRow = typeof edges.$inferSelect
export type DecisionRow = typeof decisions.$inferSelect
