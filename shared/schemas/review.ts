import { z, ZodError } from 'zod'

export const reviewIssueSchema = z.object({
  severity: z.enum(['blocker', 'major', 'minor']),
  message: z.string().min(1),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
})

export const reviewSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  summary: z.string().min(1),
  issues: z.array(reviewIssueSchema).default([]),
})

export type Review = z.infer<typeof reviewSchema>
export type ReviewIssue = z.infer<typeof reviewIssueSchema>

export function validateReview(input: unknown): Review {
  const review = reviewSchema.parse(input)

  if (review.verdict === 'fail' && review.issues.length === 0) {
    throw new Error('审查未通过时必须至少列出一个问题')
  }

  return review
}

export function formatReviewError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')
  }
  return error instanceof Error ? error.message : String(error)
}
