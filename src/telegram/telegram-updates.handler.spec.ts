import { ConfigService } from '@nestjs/config';
import { Context, InlineKeyboard } from 'grammy';
import { AccessRequestsService } from '../access-requests/application/access-requests.service';
import { TelegramAccessService } from '../users/application/telegram-access.service';
import { TelegramAccessRequestNotifierService } from './telegram-access-request-notifier.service';
import { TelegramUpdatesHandler } from './telegram-updates.handler';

describe('TelegramUpdatesHandler', () => {
  const configServiceMock = { get: jest.fn(), getOrThrow: jest.fn() };
  const telegramAccessServiceMock = { resolveAccess: jest.fn() };
  const accessRequestsServiceMock = { submit: jest.fn() };
  const accessRequestNotifierMock = { notifyModerators: jest.fn() };
  const handler = new TelegramUpdatesHandler(
    configServiceMock as unknown as ConfigService,
    telegramAccessServiceMock as unknown as TelegramAccessService,
    accessRequestsServiceMock as unknown as AccessRequestsService,
    accessRequestNotifierMock as unknown as TelegramAccessRequestNotifierService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockReturnValue('-1001234567890');
    configServiceMock.getOrThrow.mockReturnValue('-1001234567890');
    telegramAccessServiceMock.resolveAccess.mockResolvedValue({
      kind: 'NOT_REGISTERED',
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

  it('shows an explicit access-request button to an unregistered private user', async () => {
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

    expect(telegramAccessServiceMock.resolveAccess).toHaveBeenCalledWith(
      '123456789',
    );
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it('opens the same private menu from the approval notification button', async () => {
    telegramAccessServiceMock.resolveAccess.mockResolvedValue({
      kind: 'ACTIVE',
      user: { firstName: 'Іван' },
    });
    const reply = jest.fn().mockResolvedValue(undefined);
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);

    await (
      handler as unknown as { openMenu: (context: Context) => Promise<void> }
    ).openMenu({
      chat: { id: 123456789, type: 'private' },
      from: { id: 123456789, first_name: 'Іван' },
      reply,
      answerCallbackQuery,
    } as unknown as Context);

    expect(answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith('Вітаємо, Іван!', {
      reply_markup: new InlineKeyboard()
        .text('📅 Сьогодні', 'menu:today')
        .row()
        .text('🎂 Усі дні народження', 'menu:birthdays')
        .row()
        .text('🗓 Дні народження цього місяця', 'menu:birthdays:month')
        .row()
        .text('ℹ️ Як користуватися', 'menu:info'),
    });
  });
});
