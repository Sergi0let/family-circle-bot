/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { TelegramUserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TelegramUsersService } from './telegram-users.service';

describe('TelegramUsersService', () => {
  const prismaMock = { telegramUser: { upsert: jest.fn() } };
  const service = new TelegramUsersService(
    prismaMock as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a pending record when a person opens the private chat', async () => {
    prismaMock.telegramUser.upsert.mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      status: TelegramUserStatus.PENDING,
    });

    await service.registerPrivateUser({
      telegramUserId: '123456789',
      privateChatId: '123456789',
      firstName: 'Іван',
    });

    expect(prismaMock.telegramUser.upsert).toHaveBeenCalledWith({
      where: { telegramUserId: '123456789' },
      create: {
        telegramUserId: '123456789',
        privateChatId: '123456789',
        firstName: 'Іван',
        lastName: null,
        username: null,
      },
      update: {
        privateChatId: '123456789',
        firstName: 'Іван',
      },
    });
  });

  it('activates a pending user through the administrator API', async () => {
    prismaMock.telegramUser.upsert.mockResolvedValue({
      status: TelegramUserStatus.ACTIVE,
    });

    await service.createOrActivate({
      telegramUserId: '123456789',
      firstName: 'Іван',
    });

    expect(prismaMock.telegramUser.upsert).toHaveBeenCalledWith({
      where: { telegramUserId: '123456789' },
      create: {
        telegramUserId: '123456789',
        privateChatId: null,
        firstName: 'Іван',
        lastName: null,
        username: null,
        status: TelegramUserStatus.ACTIVE,
      },
      update: {
        firstName: 'Іван',
        status: TelegramUserStatus.ACTIVE,
      },
    });
  });
});
