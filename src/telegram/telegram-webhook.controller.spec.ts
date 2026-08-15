import { Update } from 'grammy/types';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

describe('TelegramWebhookController', () => {
  const telegramBotServiceMock = { handleWebhookUpdate: jest.fn() };
  const controller = new TelegramWebhookController(
    telegramBotServiceMock as unknown as TelegramBotService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards the update and Telegram secret to the bot service', async () => {
    const update = { update_id: 1 } as Update;

    await controller.handleUpdate(update, 'webhook-secret');

    expect(telegramBotServiceMock.handleWebhookUpdate).toHaveBeenCalledWith(
      update,
      'webhook-secret',
    );
  });
});
