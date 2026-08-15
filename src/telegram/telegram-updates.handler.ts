import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';

@Injectable()
export class TelegramUpdatesHandler {
  private readonly logger = new Logger(TelegramUpdatesHandler.name);

  constructor(private readonly configService: ConfigService) {}

  register(bot: Bot<Context>): void {
    bot.command('start', (context) => this.handleStart(context));
  }

  async handleStart(context: Context): Promise<void> {
    const chat = context.chat;

    if (chat === undefined || chat.type === 'private') {
      await context.reply(
        'Додай мене до сімейної групи та виконай /start там.',
      );
      return;
    }

    const configuredChatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (configuredChatId === undefined) {
      this.logger.warn(
        `TELEGRAM_CHAT_ID is not configured. Received /start from chat ${chat.id}.`,
      );
      await context.reply(
        `ID цієї групи: ${chat.id}\n\nДодай його до TELEGRAM_CHAT_ID у .env і перезапусти бота.`,
      );
      return;
    }

    if (!this.isConfiguredGroup(context)) {
      await context.reply('Цей бот налаштований для іншої сімейної групи.');
      return;
    }

    await context.reply(
      'Family Circle активний. Переглянь події на сьогодні командою /calendar_today.',
    );
  }

  private isConfiguredGroup(context: Context): boolean {
    const chat = context.chat;

    return (
      chat !== undefined &&
      (chat.type === 'group' || chat.type === 'supergroup') &&
      String(chat.id) === this.configService.get<string>('TELEGRAM_CHAT_ID')
    );
  }
}
