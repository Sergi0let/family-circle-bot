import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramUserStatus } from '@prisma/client';
import { Bot, Context } from 'grammy';
import { TelegramUsersService } from '../users/application/telegram-users.service';

@Injectable()
export class TelegramUpdatesHandler {
  private readonly logger = new Logger(TelegramUpdatesHandler.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramUsersService: TelegramUsersService,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command('start', (context) => this.handleStart(context));
  }

  async handleStart(context: Context): Promise<void> {
    const chat = context.chat;

    if (chat?.type === 'private') {
      await this.registerPrivateUser(context);
      return;
    }

    if (chat === undefined) {
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

  private async registerPrivateUser(context: Context): Promise<void> {
    const user = context.from;
    const chat = context.chat;

    if (user === undefined || chat?.type !== 'private') {
      await context.reply('Не вдалося визначити ваш Telegram профіль.');
      return;
    }

    try {
      const registeredUser =
        await this.telegramUsersService.registerPrivateUser({
          telegramUserId: String(user.id),
          privateChatId: String(chat.id),
          firstName: user.first_name,
          ...(user.last_name === undefined ? {} : { lastName: user.last_name }),
          ...(user.username === undefined ? {} : { username: user.username }),
        });

      if (registeredUser.status === TelegramUserStatus.ACTIVE) {
        await context.reply(
          'Ваш профіль Family Circle активний. Персональні функції з’являться тут.',
        );
        return;
      }

      if (registeredUser.status === TelegramUserStatus.BLOCKED) {
        await context.reply(
          'Доступ до Family Circle для цього профілю вимкнено.',
        );
        return;
      }

      await context.reply(
        `Заявку збережено. Передайте адміністратору ваш Telegram ID: ${user.id}. Після підтвердження відкрийте /start ще раз.`,
      );
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to register private Telegram user.', details);
      await context.reply('Не вдалося зберегти заявку. Спробуйте пізніше.');
    }
  }
}
