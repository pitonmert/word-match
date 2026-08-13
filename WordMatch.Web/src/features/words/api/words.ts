import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { practiceOutcomeSchema } from "@/features/practice/api/practice";

const wordsEndpoint = "/api/words";

export const wordResponseSchema = z.object({
  id: z.number().int().nonnegative(),
  english: z.string(),
  turkishTranslations: z.array(z.string()),
  partOfSpeech: z.string(),
  pastSimple: z.string().nullable(),
  pastParticiple: z.string().nullable(),
  isIrregular: z.boolean(),
  level: z.string(),
  topic: z.string(),
  currentOutcome: practiceOutcomeSchema.nullable(),
});

export type WordResponse = z.infer<typeof wordResponseSchema>;

export async function fetchWords(
  signal?: AbortSignal,
): Promise<WordResponse[]> {
  return apiRequest(wordsEndpoint, z.array(wordResponseSchema), { signal });
}
