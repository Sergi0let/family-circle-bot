import { PrismaService } from '../../prisma/prisma.service';
import {
  confirmedWrite,
  WriteConfirmationRequiredError,
} from './confirmed-write';
import { FamilyGroupsService } from './family-groups.service';

describe('FamilyGroupsService', () => {
  const familyGroup = {
    id: 'family-group-id',
    telegramChatId: -1001234567890n,
    title: 'Family Circle',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prismaMock = {
    familyGroup: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new FamilyGroupsService(
    prismaMock as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a family group after confirmation', async () => {
    prismaMock.familyGroup.upsert.mockResolvedValue(familyGroup);

    const result = await service.register(
      confirmedWrite({
        telegramChatId: familyGroup.telegramChatId,
        title: '  Family Circle  ',
      }),
    );

    expect(result).toEqual(familyGroup);
    expect(prismaMock.familyGroup.upsert).toHaveBeenCalledWith({
      where: { telegramChatId: familyGroup.telegramChatId },
      create: {
        telegramChatId: familyGroup.telegramChatId,
        title: 'Family Circle',
      },
      update: { title: 'Family Circle' },
    });
  });

  it('retrieves a group by its Telegram chat id', async () => {
    prismaMock.familyGroup.findUnique.mockResolvedValue(familyGroup);

    await expect(
      service.findByTelegramChatId(familyGroup.telegramChatId),
    ).resolves.toEqual(familyGroup);
    expect(prismaMock.familyGroup.findUnique).toHaveBeenCalledWith({
      where: { telegramChatId: familyGroup.telegramChatId },
    });
  });

  it('rejects a group write without confirmation', async () => {
    await expect(
      service.register({
        input: {
          telegramChatId: familyGroup.telegramChatId,
          title: familyGroup.title,
        },
        confirmation: { confirmedAt: new Date('invalid') },
      }),
    ).rejects.toThrow(WriteConfirmationRequiredError);
    expect(prismaMock.familyGroup.upsert).not.toHaveBeenCalled();
  });
});
