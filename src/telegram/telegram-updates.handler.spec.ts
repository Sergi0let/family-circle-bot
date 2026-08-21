import { ConfigService } from '@nestjs/config';
import { TelegramUserStatus } from '@prisma/client';
import { Context } from 'grammy';
import { TelegramUsersService } from '../users/application/telegram-users.service';
import { TelegramUpdatesHandler } from './telegram-updates.handler';

describe('TelegramUpdatesHandler', () => {
  const configServiceMock = { get: jest.fn(), getOrThrow: jest.fn() };
  const telegramUsersServiceMock = { registerPrivateUser: jest.fn() };
  const handler = new TelegramUpdatesHandler(
    configServiceMock as unknown as ConfigService,
    telegramUsersServiceMock as unknown as TelegramUsersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockReturnValue('-1001234567890');
    configServiceMock.getOrThrow.mockReturnValue('-1001234567890');
    telegramUsersServiceMock.registerPrivateUser.mockResolvedValue({
      status: TelegramUserStatus.PENDING,
    });
  });

  it('confirms activation in the configured group', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Family Circle',
      },
      reply,
    };

    await handler.handleStart(context as unknown as Context);

    expect(reply).toHaveBeenCalledWith(
      'Family Circle активний. Переглянь події на сьогодні командою /calendar_today.',
    );
  });

  it('does not activate in another group', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: { id: -1009876543210, type: 'supergroup', title: 'Other group' },
      reply,
    };

    await handler.handleStart(context as unknown as Context);

    expect(reply).toHaveBeenCalledWith(
      'Цей бот налаштований для іншої сімейної групи.',
    );
  });

  it('shows the chat ID when local configuration is incomplete', async () => {
    configServiceMock.getOrThrow.mockReturnValue(undefined);
    configServiceMock.get.mockReturnValue(undefined);
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Family Circle',
      },
      reply,
    };

    await handler.handleStart(context as unknown as Context);

    expect(reply).toHaveBeenCalledWith(
      'ID цієї групи: -1001234567890\n\nДодай його до TELEGRAM_CHAT_ID у .env і перезапусти бота.',
    );
  });

  it('registers a private-chat user as pending without granting access', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: { id: 123456789, type: 'private' },
      from: {
        id: 123456789,
        first_name: 'Іван',
        username: 'ivan_family',
      },
      reply,
    };

    await handler.handleStart(context as unknown as Context);

    expect(telegramUsersServiceMock.registerPrivateUser).toHaveBeenCalledWith({
      telegramUserId: '123456789',
      privateChatId: '123456789',
      firstName: 'Іван',
      username: 'ivan_family',
    });
    expect(reply).toHaveBeenCalledWith(
      'Заявку збережено. Передайте адміністратору ваш Telegram ID: 123456789. Після підтвердження відкрийте /start ще раз.',
    );
  });
});
