import { z } from 'zod';

export const greetingKindSchema = z.enum(['birthday', 'church', 'public']);

export const greetingGenerationInputSchema = z
  .object({
    kind: greetingKindSchema,
    occasion: z.string().trim().min(1).max(120),
    recipientName: z.string().trim().min(1).max(80).optional(),
    relation: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export type GreetingGenerationInput = z.infer<
  typeof greetingGenerationInputSchema
>;

export const greetingDraftSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(
        (value) =>
          Array.from(value).every((character) => {
            const codePoint = character.codePointAt(0);

            return (
              codePoint !== undefined &&
              (codePoint >= 32 ||
                codePoint === 9 ||
                codePoint === 10 ||
                codePoint === 13)
            );
          }),
        'Greeting must not contain control characters.',
      ),
  })
  .strict();

export type GreetingDraft = z.infer<typeof greetingDraftSchema>;

export abstract class GreetingGenerator {
  abstract generate(input: GreetingGenerationInput): Promise<GreetingDraft>;
}
