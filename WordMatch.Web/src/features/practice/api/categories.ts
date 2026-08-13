import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { practiceModeSchema } from "@/features/practice/api/practice";

const categoriesEndpoint = "/api/categories";

export const practiceCategoriesQueryKey = ["practice", "categories"] as const;

export const categoryModeStatusSchema = z.object({
  mode: practiceModeSchema,
  completedQuestionCount: z.number().int().nonnegative(),
  totalQuestionCount: z.number().int().nonnegative(),
  activeSessionId: z.string().nullish(),
  activeAnsweredCount: z.number().int().nonnegative().optional(),
  activeTotalCount: z.number().int().nonnegative().optional(),
  isReplay: z.boolean().optional(),
});
export type CategoryModeStatus = z.infer<typeof categoryModeStatusSchema>;

export const categoryProgressStatusSchema = z.enum([
  "Available",
  "InProgress",
  "Completed",
]);
export type CategoryProgressStatus = z.infer<
  typeof categoryProgressStatusSchema
>;

export const categoryOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  wordCount: z.number().int().nonnegative(),
  completedQuestionCount: z.number().int().nonnegative(),
  totalQuestionCount: z.number().int().nonnegative(),
  status: categoryProgressStatusSchema,
  modes: z.array(categoryModeStatusSchema),
});
export type CategoryOption = z.infer<typeof categoryOptionSchema>;

export const levelCategorySchema = z.object({
  value: z.string(),
  label: z.string(),
  wordCount: z.number().int().nonnegative(),
  topics: z.array(categoryOptionSchema),
});
export type LevelCategory = z.infer<typeof levelCategorySchema>;

export const categoryResponseSchema = z.object({
  levels: z.array(levelCategorySchema),
});
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;

export async function fetchCategories(
  signal?: AbortSignal,
): Promise<CategoryResponse> {
  return apiRequest(categoriesEndpoint, categoryResponseSchema, { signal });
}

export function findCategoryOption(
  categories: CategoryResponse | undefined,
  level: string | null,
  topic: string | null,
) {
  if (!categories || !level || !topic) return null;

  return (
    categories.levels
      .find((item) => item.value === level)
      ?.topics.find((item) => item.value === topic) ?? null
  );
}

export async function resetCategoryProgress(level: string, topic: string) {
  await apiRequest(
    `${categoriesEndpoint}/${encodeURIComponent(level)}/${encodeURIComponent(topic)}/progress`,
    z.void(),
    { method: "DELETE" },
  );
}
