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

export function normalizeOptionalText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? null : normalizedValue;
}

export function assertValidDate(value: Date, field: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new InvalidFamilyInputError(field);
  }

  return value;
}
