import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramUserRole } from '@prisma/client';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { AccessRequestsService } from '../access-requests/application/access-requests.service';
import { TelegramAccessService } from '../users/application/telegram-access.service';
import { TelegramAccessRequestNotifierService } from './telegram-access-request-notifier.service';

@Injectable()
export class TelegramUpdatesHandler {
  private readonly logger = new Logger(TelegramUpdatesHandler.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramAccessService: TelegramAccessService,
    private readonly accessRequestsService: AccessRequestsService,
    private readonly accessRequestNotifier: TelegramAccessRequestNotifierService,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command('start', (context) => this.handleStart(context));

    bot.callbackQuery('menu:open', (context) => this.openMenu(context));

    bot.callbackQuery('access:request', async (context) => {
      await this.showRequestConfirmation(context);
    });

    bot.callbackQuery('access:request:confirm', (context) =>
      this.createAccessRequest(context),
    );

    bot.callbackQuery('access:request:cancel', (context) =>
      this.cancelAccessRequest(context),
    );
  }

  async handleStart(context: Context): Promise<void> {
    const chat = context.chat;

    if (chat?.type === 'private') {
      await this.handlePrivateStart(context);
      // await this.registerPrivateUser(context);
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

  private async handlePrivateStart(context: Context): Promise<void> {
    const user = context.from;
    const chat = context.chat;

    if (user === undefined || chat?.type !== 'private') {
      await context.reply('Не вдалося визначити ваш Telegram профіль.');
      return;
    }

    const access = await this.telegramAccessService.resolveAccess(
      String(user.id),
    );

    switch (access.kind) {
      case 'NOT_REGISTERED': {
        const keyboard = new InlineKeyboard().text(
          '📝 Надіслати заявку',
          'access:request',
        );

        await context.reply(
          'Вітаємо у Family Circle. Для доступу до сімейних функцій надішліть заявку адміністратору.',
          { reply_markup: keyboard },
        );
        return;
      }

      case 'PENDING':
        await context.reply(
          '🕓 Ваша заявка очікує на підтвердження адміністратором.',
        );
        return;

      case 'REJECTED':
        await context.reply(
          'Вашу заявку не підтверджено. Зверніться до адміністратора Family Circle.',
        );
        return;

      case 'BLOCKED':
        await context.reply(
          'Доступ до Family Circle для цього профілю вимкнено.',
        );
        return;

      case 'ACTIVE': {
        const keyboard = new InlineKeyboard()
          .text('📅 Сьогодні', 'menu:today')
          .row()
          .text('🎂 Усі дні народження', 'menu:birthdays')
          .row()
          .text('🗓 Дні народження цього місяця', 'menu:birthdays:month')
          .row()
          .text('🤖 Запитати помічника', 'menu:assistant')
          .row()
          .text('ℹ️ Як користуватися', 'menu:info');

        if (access.user.role === TelegramUserRole.ADMIN) {
          keyboard.row().text('👥 Користувачі', 'admin:users:page:0');
        }

        await context.reply(
          `Вітаємо, ${access.user.firstName ?? 'учаснику'}!`,
          {
            reply_markup: keyboard,
          },
        );
        return;
      }
    }
  }

  private async openMenu(context: Context): Promise<void> {
    await context.answerCallbackQuery();
    await this.handlePrivateStart(context);
  }

  private async showRequestConfirmation(context: Context): Promise<void> {
    await context.answerCallbackQuery();

    if (context.chat?.type !== 'private' || context.from === undefined) {
      return;
    }

    const access = await this.telegramAccessService.resolveAccess(
      String(context.from.id),
    );

    if (access.kind !== 'NOT_REGISTERED') {
      await this.handlePrivateStart(context);
      return;
    }

    await context.reply('Надіслати заявку адміністратору?', {
      reply_markup: new InlineKeyboard()
        .text('✅ Підтвердити', 'access:request:confirm')
        .text('↩️ Скасувати', 'access:request:cancel'),
    });
  }

  private async createAccessRequest(context: Context): Promise<void> {
    await context.answerCallbackQuery();

    const user = context.from;
    const chat = context.chat;

    if (user === undefined || chat?.type !== 'private') {
      return;
    }

    const access = await this.telegramAccessService.resolveAccess(
      String(user.id),
    );

    if (access.kind !== 'NOT_REGISTERED') {
      await this.handlePrivateStart(context);
      return;
    }

    try {
      const submitted = await this.accessRequestsService.submit({
        telegramUserId: String(user.id),
        privateChatId: String(chat.id),
        firstName: user.first_name,
        ...(user.last_name === undefined ? {} : { lastName: user.last_name }),
        ...(user.username === undefined ? {} : { username: user.username }),
      });

      if (submitted.isNew) {
        await this.accessRequestNotifier.notifyModerators(
          submitted.request,
          context.api,
        );
      }

      await context.reply(
        '✅ Заявку надіслано. Після підтвердження адміністратором відкрийте /start ще раз.',
      );
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to submit access request.', details);
      await context.reply('Не вдалося надіслати заявку. Спробуйте пізніше.');
    }
  }

  private async cancelAccessRequest(context: Context): Promise<void> {
    await context.answerCallbackQuery('Заявку не створено.');

    await context.reply('Заявку скасовано. Ви зможете надіслати її пізніше.');
  }
}
