import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
  verification: text('verification'),
  verificationResult: text('verification_result'),
  requires: text('requires'),
  status: text('status').notNull().default('pending'),
  order: integer('node_order').notNull(),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  commitHash: text('commit_hash'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const edges = sqliteTable('edges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  planVersion: integer('plan_version').notNull(),
  sourceKey: text('source_key').notNull(),
  targetKey: text('target_key').notNull(),
})

export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  planVersion: integer('plan_version').notNull(),
  reviewNodeKey: text('review_node_key').notNull(),
  developNodeKey: text('develop_node_key').notNull(),
  commitHash: text('commit_hash'),
  verdict: text('verdict').notNull(),
  summary: text('summary').notNull(),
  issues: text('issues').notNull(),
  runId: text('run_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
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

export const memories = sqliteTable(
  'memories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull().default('project'),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    tags: text('tags').notNull().default('[]'),
    source: text('source').notNull().default('{}'),
    sourceKey: text('source_key'),
    pinned: integer('pinned').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => [
    uniqueIndex('memories_source_key_unique').on(table.sourceKey),
    index('memories_project_id_idx').on(table.projectId),
    index('memories_kind_idx').on(table.kind),
  ],
)

export const planRecalls = sqliteTable(
  'plan_recalls',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    planVersion: integer('plan_version').notNull(),
    memoryId: integer('memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    score: real('score').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  table => [
    uniqueIndex('plan_recalls_project_version_memory_unique').on(
      table.projectId,
      table.planVersion,
      table.memoryId,
    ),
    index('plan_recalls_project_version_idx').on(table.projectId, table.planVersion),
  ],
)

export const projectCanvases = sqliteTable(
  'project_canvases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    canvasId: text('canvas_id').notNull(),
    webUrl: text('web_url'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  table => [
    uniqueIndex('project_canvases_project_provider_unique').on(table.projectId, table.provider),
  ],
)

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('running'),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  error: text('error'),
})

export const runEvents = sqliteTable(
  'run_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    runId: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    ts: text('ts').notNull(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
  },
  table => [
    uniqueIndex('run_events_run_id_seq_unique').on(table.runId, table.seq),
    index('run_events_project_id_idx').on(table.projectId),
    index('run_events_run_id_idx').on(table.runId),
  ],
)

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type PlanNodeRow = typeof nodes.$inferSelect
export type PlanEdgeRow = typeof edges.$inferSelect
export type ReviewRow = typeof reviews.$inferSelect
export type DecisionRow = typeof decisions.$inferSelect
export type RunRow = typeof runs.$inferSelect
export type RunEventRow = typeof runEvents.$inferSelect
export type ProjectCanvasRow = typeof projectCanvases.$inferSelect
export type MemoryRow = typeof memories.$inferSelect
export type PlanRecallRow = typeof planRecalls.$inferSelect
