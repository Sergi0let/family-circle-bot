import { Injectable, Logger } from '@nestjs/common';
import {
  TelegramUser,
  TelegramUserRole,
  TelegramUserStatus,
} from '@prisma/client';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { UserAdministrationService } from '../users/application/user-administration.service';

const USERS_PER_PAGE = 5;

const statusLabels: Record<TelegramUserStatus, string> = {
  PENDING: 'Очікує',
  ACTIVE: 'Активний',
  BLOCKED: 'Заблокований',
  REJECTED: 'Відхилений',
};

const roleLabels: Record<TelegramUserRole, string> = {
  MEMBER: 'Учасник',
  MODERATOR: 'Модератор',
  ADMIN: 'Адміністратор',
};

type UserField = 'status' | 'role';

@Injectable()
export class TelegramUserAdministrationHandler {
  private readonly logger = new Logger(TelegramUserAdministrationHandler.name);

  constructor(
    private readonly userAdministrationService: UserAdministrationService,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command(['users', 'user'], (context) => this.showUsers(context, 0));

    bot.callbackQuery(/^admin:users:page:(\d+)$/u, (context) =>
      this.handleCallback(context, () =>
        this.showUsers(context, Number(context.match[1])),
      ),
    );
    bot.callbackQuery(/^admin:user:(-?\d+)$/u, (context) =>
      this.handleCallback(context, () =>
        this.showUser(context, context.match[1]),
      ),
    );
    bot.callbackQuery(
      /^admin:user:(-?\d+):(status|role):(PENDING|ACTIVE|BLOCKED|REJECTED|MEMBER|MODERATOR|ADMIN)$/u,
      (context) =>
        this.handleCallback(context, () =>
          this.showChangeConfirmation(
            context,
            context.match[1],
            context.match[2] as UserField,
            context.match[3],
          ),
        ),
    );
    bot.callbackQuery(
      /^admin:user:(-?\d+):(status|role):(PENDING|ACTIVE|BLOCKED|REJECTED|MEMBER|MODERATOR|ADMIN):(confirm|cancel)$/u,
      (context) =>
        this.handleCallback(context, () =>
          this.handleChangeConfirmation(
            context,
            context.match[1],
            context.match[2] as UserField,
            context.match[3],
            context.match[4] as 'confirm' | 'cancel',
          ),
        ),
    );
    bot.callbackQuery(/^admin:user:(-?\d+):delete$/u, (context) =>
      this.handleCallback(context, () =>
        this.showDeleteConfirmation(context, context.match[1]),
      ),
    );
    bot.callbackQuery(
      /^admin:user:(-?\d+):delete:(confirm|cancel)$/u,
      (context) =>
        this.handleCallback(context, () =>
          this.handleDeleteConfirmation(
            context,
            context.match[1],
            context.match[2] as 'confirm' | 'cancel',
          ),
        ),
    );
  }

  private async handleCallback(
    context: Context,
    action: () => Promise<void>,
  ): Promise<void> {
    await context.answerCallbackQuery();
    await action();
  }

  private async showUsers(context: Context, page: number): Promise<void> {
    const actorTelegramUserId = this.getPrivateActorId(context);

    if (actorTelegramUserId === null) {
      return;
    }

    try {
      const safePage = Math.max(0, page);
      const result = await this.userAdministrationService.listUsers(
        actorTelegramUserId,
        safePage * USERS_PER_PAGE,
        USERS_PER_PAGE,
      );
      const lastPage = Math.max(
        0,
        Math.ceil(result.total / USERS_PER_PAGE) - 1,
      );
      const currentPage = Math.min(safePage, lastPage);

      if (currentPage !== safePage) {
        await this.showUsers(context, currentPage);
        return;
      }

      if (result.total === 0) {
        await context.reply('👥 Користувачів поки немає.');
        return;
      }

      const first = currentPage * USERS_PER_PAGE + 1;
      const last = first + result.users.length - 1;
      await context.reply(
        [
          `👥 Користувачі ${first}–${last} із ${result.total}`,
          '',
          ...result.users.map((user) => this.formatUserSummary(user)),
          '',
          'Оберіть користувача, щоб керувати статусом і роллю.',
        ].join('\n'),
        {
          reply_markup: this.usersKeyboard(result.users, currentPage, lastPage),
        },
      );
    } catch (error: unknown) {
      this.logError('Could not list users.', error);
      await context.reply(
        'Доступ до керування користувачами має лише активний адміністратор.',
      );
    }
  }

  private async showUser(
    context: Context,
    telegramUserId: string,
  ): Promise<void> {
    const actorTelegramUserId = this.getPrivateActorId(context);

    if (actorTelegramUserId === null) {
      return;
    }

    try {
      const user = await this.userAdministrationService.getUser(
        actorTelegramUserId,
        telegramUserId,
      );
      await context.reply(this.formatUserDetails(user), {
        reply_markup: this.userKeyboard(user),
      });
    } catch (error: unknown) {
      this.logError(`Could not show Telegram user ${telegramUserId}.`, error);
      await context.reply(
        'Користувача не знайдено або доступ до керування відсутній.',
      );
    }
  }

  private async showChangeConfirmation(
    context: Context,
    telegramUserId: string,
    field: UserField,
    value: string,
  ): Promise<void> {
    const actorTelegramUserId = this.getPrivateActorId(context);

    if (actorTelegramUserId === null) {
      return;
    }

    try {
      const user = await this.userAdministrationService.getUser(
        actorTelegramUserId,
        telegramUserId,
      );
      const targetValue = this.getValidValue(field, value);
      const fieldLabel = field === 'status' ? 'статус' : 'роль';
      const valueLabel =
        field === 'status'
          ? statusLabels[targetValue as TelegramUserStatus]
          : roleLabels[targetValue as TelegramUserRole];

      await context.reply(
        `Змінити ${fieldLabel} користувача ${this.displayName(user)} на «${valueLabel}»?`,
        {
          reply_markup: new InlineKeyboard()
            .text(
              '✅ Підтвердити',
              `admin:user:${telegramUserId}:${field}:${targetValue}:confirm`,
            )
            .text(
              '↩️ Скасувати',
              `admin:user:${telegramUserId}:${field}:${targetValue}:cancel`,
            ),
        },
      );
    } catch (error: unknown) {
      this.logError(
        `Could not prepare an update for ${telegramUserId}.`,
        error,
      );
      await context.reply(
        'Не вдалося підготувати зміну: користувач недоступний або бракує прав.',
      );
    }
  }

  private async handleChangeConfirmation(
    context: Context,
    telegramUserId: string,
    field: UserField,
    value: string,
    action: 'confirm' | 'cancel',
  ): Promise<void> {
    if (action === 'cancel') {
      await this.showUser(context, telegramUserId);
      return;
    }

    const actorTelegramUserId = this.getPrivateActorId(context);

    if (actorTelegramUserId === null) {
      return;
    }

    try {
      const targetValue = this.getValidValue(field, value);
      const user =
        field === 'status'
          ? await this.userAdministrationService.changeStatus(
              actorTelegramUserId,
              telegramUserId,
              targetValue as TelegramUserStatus,
            )
          : await this.userAdministrationService.changeRole(
              actorTelegramUserId,
              telegramUserId,
              targetValue as TelegramUserRole,
            );

      await context.reply('✅ Зміни збережено.');
      await context.reply(this.formatUserDetails(user), {
        reply_markup: this.userKeyboard(user),
      });
    } catch (error: unknown) {
      this.logError(`Could not update Telegram user ${telegramUserId}.`, error);
      await context.reply(
        'Не вдалося зберегти зміну. Неможливо змінити себе або прибрати останнього активного адміністратора.',
      );
    }
  }

  private async showDeleteConfirmation(
    context: Context,
    telegramUserId: string,
  ): Promise<void> {
    const actorTelegramUserId = this.getPrivateActorId(context);

    if (actorTelegramUserId === null) {
      return;
    }

    try {
      const user = await this.userAdministrationService.getUser(
        actorTelegramUserId,
        telegramUserId,
      );

      await context.reply(
        `Видалити користувача ${this.displayName(user)}? Пов’язану заявку на доступ також буде видалено. Цю дію неможливо скасувати.`,
        {
          reply_markup: new InlineKeyboard()
            .text(
              '🗑 Так, видалити',
              `admin:user:${telegramUserId}:delete:confirm`,
            )
            .text('↩️ Скасувати', `admin:user:${telegramUserId}:delete:cancel`),
        },
      );
    } catch (error: unknown) {
      this.logError(`Could not prepare deletion for ${telegramUserId}.`, error);
      await context.reply(
        'Не вдалося підготувати видалення: користувач недоступний або бракує прав.',
      );
    }
  }

  private async handleDeleteConfirmation(
    context: Context,
    telegramUserId: string,
    action: 'confirm' | 'cancel',
  ): Promise<void> {
    if (action === 'cancel') {
      await this.showUser(context, telegramUserId);
      return;
    }

    const actorTelegramUserId = this.getPrivateActorId(context);

    if (actorTelegramUserId === null) {
      return;
    }

    try {
      await this.userAdministrationService.deleteUser(
        actorTelegramUserId,
        telegramUserId,
      );
      await context.reply('✅ Користувача та пов’язану заявку видалено.');
      await this.showUsers(context, 0);
    } catch (error: unknown) {
      this.logError(`Could not delete Telegram user ${telegramUserId}.`, error);
      await context.reply(
        'Не вдалося видалити користувача. Неможливо видалити себе або останнього активного адміністратора.',
      );
    }
  }

  private usersKeyboard(
    users: TelegramUser[],
    page: number,
    lastPage: number,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    for (const user of users) {
      keyboard.text(
        this.limitButtonLabel(
          `${this.displayName(user)} · ${statusLabels[user.status]}`,
        ),
        `admin:user:${user.telegramUserId}`,
      );
      keyboard.row();
    }

    if (page > 0) {
      keyboard.text('◀️ Назад', `admin:users:page:${page - 1}`);
    }
    if (page < lastPage) {
      keyboard.text('Вперед ▶️', `admin:users:page:${page + 1}`);
    }

    return keyboard;
  }

  private userKeyboard(user: TelegramUser): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    for (const status of Object.values(TelegramUserStatus)) {
      if (status !== user.status) {
        keyboard.text(
          `Статус: ${statusLabels[status]}`,
          `admin:user:${user.telegramUserId}:status:${status}`,
        );
        keyboard.row();
      }
    }

    for (const role of Object.values(TelegramUserRole)) {
      if (role !== user.role) {
        keyboard.text(
          `Роль: ${roleLabels[role]}`,
          `admin:user:${user.telegramUserId}:role:${role}`,
        );
        keyboard.row();
      }
    }

    keyboard
      .row()
      .text(
        '🗑 Видалити користувача',
        `admin:user:${user.telegramUserId}:delete`,
      );
    keyboard.row();
    keyboard.text('👥 До списку', 'admin:users:page:0');
    return keyboard;
  }

  private getPrivateActorId(context: Context): string | null {
    if (context.chat?.type !== 'private' || context.from === undefined) {
      return null;
    }

    return String(context.from.id);
  }

  private getValidValue(
    field: UserField,
    value: string,
  ): TelegramUserStatus | TelegramUserRole {
    if (
      field === 'status' &&
      Object.values(TelegramUserStatus).includes(value as TelegramUserStatus)
    ) {
      return value as TelegramUserStatus;
    }

    if (
      field === 'role' &&
      Object.values(TelegramUserRole).includes(value as TelegramUserRole)
    ) {
      return value as TelegramUserRole;
    }

    throw new Error('Invalid user administration value.');
  }

  private formatUserSummary(user: TelegramUser): string {
    return `• ${this.displayName(user)} — ${statusLabels[user.status]}, ${roleLabels[user.role]}`;
  }

  private formatUserDetails(user: TelegramUser): string {
    const username = user.username === null ? '—' : `@${user.username}`;
    const privateChat = user.privateChatId === null ? '—' : user.privateChatId;

    return [
      `👤 ${this.displayName(user)}`,
      `Telegram ID: ${user.telegramUserId}`,
      `Username: ${username}`,
      `Приватний чат: ${privateChat}`,
      `Статус: ${statusLabels[user.status]}`,
      `Роль: ${roleLabels[user.role]}`,
    ].join('\n');
  }

  private displayName(user: TelegramUser): string {
    const name = [user.firstName, user.lastName]
      .filter((part): part is string => part !== null && part.length > 0)
      .join(' ');

    return (
      name ||
      (user.username === null ? user.telegramUserId : `@${user.username}`)
    );
  }

  private limitButtonLabel(label: string): string {
    return label.length <= 64 ? label : `${label.slice(0, 61)}…`;
  }

  private logError(message: string, error: unknown): void {
    const details = error instanceof Error ? error.message : String(error);
    this.logger.warn(`${message} ${details}`);
  }
}
