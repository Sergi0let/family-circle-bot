import {
  memberAddInputSchema,
  parseMemberAddArguments,
} from './member-add.schema';

describe('memberAddInputSchema', () => {
  it('parses a member with an optional last name', () => {
    const parsed = memberAddInputSchema.parse(
      parseMemberAddArguments('Olena; 1990-05-14'),
    );

    expect(parsed).toEqual({
      firstName: 'Olena',
      lastName: null,
      birthDate: new Date('1990-05-14T00:00:00.000Z'),
    });
  });

  it('rejects invalid calendar dates', () => {
    const parsed = memberAddInputSchema.safeParse(
      parseMemberAddArguments('Olena; Koval; 1990-02-30'),
    );

    expect(parsed.success).toBe(false);
  });
});
