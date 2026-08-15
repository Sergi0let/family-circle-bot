import { z } from 'zod';

const isoBirthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD for the birth date.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Use a valid calendar date.')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const memberAddInputSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).nullable(),
  birthDate: isoBirthDateSchema,
});

export type MemberAddInput = z.output<typeof memberAddInputSchema>;

export function parseMemberAddArguments(argumentsText: string): unknown {
  const parts = argumentsText.split(';').map((part) => part.trim());

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: null,
      birthDate: parts[1],
    };
  }

  if (parts.length === 3) {
    return {
      firstName: parts[0],
      lastName: parts[1],
      birthDate: parts[2],
    };
  }

  return undefined;
}
