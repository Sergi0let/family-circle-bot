export class InvalidFamilyInputError extends Error {
  constructor(field: string) {
    super(`Invalid ${field}.`);
  }
}

export function normalizeRequiredText(value: string, field: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new InvalidFamilyInputError(field);
  }

  return normalizedValue;
}
