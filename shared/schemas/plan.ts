import { z, ZodError } from 'zod'

export const verificationCommandSchema = z.object({
  command: z.string().min(1).max(2000),
  expectedExitCode: z.number().int().default(0),
  expectedOutput: z.string().max(2000).optional(),
  timeoutMs: z.number().int().positive().max(120000).optional(),
})

export const verificationSchema = z.object({
  commands: z.array(verificationCommandSchema).max(5).default([]),
  artifacts: z.array(z.string().min(1).max(500)).max(10).default([]),
})

export const planNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['develop', 'review', 'gate']),
  title: z.string().min(1),
  spec: z.string().min(1),
  order: z.number().int().nonnegative(),
  verification: verificationSchema.optional(),
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
export type PlanVerification = z.infer<typeof verificationSchema>
export type PlanVerificationCommand = z.infer<typeof verificationCommandSchema>

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

  for (const node of plan.nodes) {
    if (node.kind !== 'develop') {
      continue
    }
    const checks =
      (node.verification?.commands.length ?? 0) + (node.verification?.artifacts.length ?? 0)
    if (checks === 0) {
      throw new Error(`开发节点 ${node.id} 必须提供至少一条验收命令或一个产物`)
    }
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
