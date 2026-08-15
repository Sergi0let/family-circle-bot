import { ConfigService } from '@nestjs/config';
import { Context } from 'grammy';
import { TelegramUpdatesHandler } from './telegram-updates.handler';

describe('TelegramUpdatesHandler', () => {
  const configServiceMock = { get: jest.fn(), getOrThrow: jest.fn() };
  const handler = new TelegramUpdatesHandler(
    configServiceMock as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockReturnValue('-1001234567890');
    configServiceMock.getOrThrow.mockReturnValue('-1001234567890');
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
});
