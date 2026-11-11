import { z, ZodError } from 'zod'

export const planNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['develop', 'review', 'gate']),
  title: z.string().min(1),
  spec: z.string().min(1),
  order: z.number().int().nonnegative(),
})

export const planEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
})

export const planSchema = z.object({
  summary: z.string().min(1),
  nodes: z.array(planNodeSchema).min(1),
  edges: z.array(planEdgeSchema),
})

export type Plan = z.infer<typeof planSchema>
export type PlanNode = z.infer<typeof planNodeSchema>

export function validatePlan(input: unknown): Plan {
  const plan = planSchema.parse(input)

  const ids = new Set(plan.nodes.map(node => node.id))
  if (ids.size !== plan.nodes.length) {
    throw new Error('计划中的节点 id 有重复')
  }

  const orders = new Set(plan.nodes.map(node => node.order))
  if (orders.size !== plan.nodes.length) {
    throw new Error('计划中的 order 有重复')
  }

  for (const edge of plan.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      throw new Error(`连线引用了不存在的节点：${edge.source} -> ${edge.target}`)
    }
  }

  return plan
}

export function formatPlanError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')
  }
  return error instanceof Error ? error.message : String(error)
}
