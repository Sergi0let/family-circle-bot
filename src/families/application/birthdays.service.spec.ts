import { FamilyGroupsService } from './family-groups.service';
import { FamilyMembersService } from './family-members.service';
import { BirthdaysService } from './birthdays.service';

describe('BirthdaysService', () => {
  const familyGroup = {
    id: 'family-group-id',
    telegramChatId: -1001234567890n,
    title: 'Family Circle',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const familyGroupsServiceMock = {
    findByTelegramChatId: jest.fn(),
  };
  const familyMembersServiceMock = {
    listByFamilyGroupId: jest.fn(),
  };
  const service = new BirthdaysService(
    familyGroupsServiceMock as unknown as FamilyGroupsService,
    familyMembersServiceMock as unknown as FamilyMembersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sorts all birthdays by their next occurrence', async () => {
    familyGroupsServiceMock.findByTelegramChatId.mockResolvedValue(familyGroup);
    familyMembersServiceMock.listByFamilyGroupId.mockResolvedValue([
      {
        id: 'olena',
        familyGroupId: familyGroup.id,
        firstName: 'Olena',
        lastName: null,
        birthDate: new Date('1990-12-30T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'andriy',
        familyGroupId: familyGroup.id,
        firstName: 'Andriy',
        lastName: null,
        birthDate: new Date('1990-01-02T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForTelegramChatId(
      familyGroup.telegramChatId,
      new Date('2026-12-31T12:00:00.000Z'),
    );

    expect(result).not.toBeNull();
    expect(result?.birthdays.map((birthday) => birthday.member.id)).toEqual([
      'andriy',
      'olena',
    ]);
    expect(result?.birthdays.map((birthday) => birthday.daysUntil)).toEqual([
      2, 364,
    ]);
  });

  it('uses February 28 for a leap-day birthday in a non-leap year', async () => {
    familyGroupsServiceMock.findByTelegramChatId.mockResolvedValue(familyGroup);
    familyMembersServiceMock.listByFamilyGroupId.mockResolvedValue([
      {
        id: 'leap-day',
        familyGroupId: familyGroup.id,
        firstName: 'Leap',
        lastName: null,
        birthDate: new Date('2000-02-29T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForTelegramChatId(
      familyGroup.telegramChatId,
      new Date('2026-02-27T12:00:00.000Z'),
    );

    expect(result?.birthdays[0]).toEqual(
      expect.objectContaining({
        occurrence: { year: 2026, month: 2, day: 28 },
        daysUntil: 1,
      }),
    );
  });
});
