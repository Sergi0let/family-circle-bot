export interface ConfirmedWrite<TInput> {
  readonly input: TInput;
  readonly confirmation: {
    readonly confirmedAt: Date;
  };
}

export class WriteConfirmationRequiredError extends Error {
  constructor() {
    super('A confirmed write operation is required.');
  }
}

export function confirmedWrite<TInput>(
  input: TInput,
  confirmedAt: Date = new Date(),
): ConfirmedWrite<TInput> {
  return {
    input,
    confirmation: { confirmedAt },
  };
}

export function getConfirmedInput<TInput>(
  command: ConfirmedWrite<TInput>,
): TInput {
  const confirmedAt = command?.confirmation?.confirmedAt;

  if (!(confirmedAt instanceof Date) || Number.isNaN(confirmedAt.getTime())) {
    throw new WriteConfirmationRequiredError();
  }

  return command.input;
}
