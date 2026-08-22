import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import { FamilyBirthday } from '../calendar/application/family-birthday';
import { FamilyCalendarEvent } from '../calendar/application/family-calendar-event';
import { CalendarService } from '../calendar/application/calendar.service';
import { TelegramAccessService } from '../users/application/telegram-access.service';

const MAX_MESSAGE_LENGTH = 4_096;

@Injectable()
export class TelegramMemberMenuHandler {
  private readonly logger = new Logger(TelegramMemberMenuHandler.name);

  constructor(
    private readonly telegramAccessService: TelegramAccessService,
    private readonly calendarService: CalendarService,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command('today', (context) => this.showToday(context));
    bot.command('birthdays', (context) => this.showAllBirthdays(context));
    bot.command('info', (context) => this.showInfo(context));

    bot.callbackQuery('menu:today', (context) =>
      this.handleCallback(context, () => this.showToday(context)),
    );
    bot.callbackQuery('menu:birthdays', (context) =>
      this.handleCallback(context, () => this.showAllBirthdays(context)),
    );
    bot.callbackQuery('menu:birthdays:month', (context) =>
      this.handleCallback(context, () => this.showBirthdaysThisMonth(context)),
    );
    bot.callbackQuery('menu:info', (context) =>
      this.handleCallback(context, () => this.showInfo(context)),
    );
  }

  private async handleCallback(
    context: Context,
    action: () => Promise<void>,
  ): Promise<void> {
    await context.answerCallbackQuery();
    await action();
  }

  private async showToday(context: Context): Promise<void> {
    if (!(await this.hasActivePrivateAccess(context))) {
      return;
    }

    try {
      const events = await this.calendarService.listToday();

      if (events.length === 0) {
        await context.reply('На сьогодні свят або подій немає.');
        return;
      }

      await this.replyInChunks(context, [
        '📅 Сьогодні:',
        ...events.map((event) => `• ${this.formatTodayEvent(event)}`),
      ]);
    } catch (error: unknown) {
      this.logCalendarError(error);
      await context.reply(
        'Не вдалося отримати події. Спробуйте трохи пізніше.',
      );
    }
  }

  private async showAllBirthdays(context: Context): Promise<void> {
    if (!(await this.hasActivePrivateAccess(context))) {
      return;
    }

    try {
      await this.showBirthdays(context, '🎂 Усі дні народження', () =>
        this.calendarService.listBirthdays(),
      );
    } catch (error: unknown) {
      this.logCalendarError(error);
      await context.reply(
        'Не вдалося отримати дні народження. Спробуйте трохи пізніше.',
      );
    }
  }

  private async showBirthdaysThisMonth(context: Context): Promise<void> {
    if (!(await this.hasActivePrivateAccess(context))) {
      return;
    }

    try {
      const month = new Intl.DateTimeFormat('uk-UA', {
        month: 'long',
        timeZone: 'Europe/Kyiv',
      }).format(new Date());

      await this.showBirthdays(
        context,
        `🎂 Дні народження цього місяця (${month})`,
        () => this.calendarService.listBirthdaysThisMonth(),
      );
    } catch (error: unknown) {
      this.logCalendarError(error);
      await context.reply(
        'Не вдалося отримати дні народження. Спробуйте трохи пізніше.',
      );
    }
  }

  private async showBirthdays(
    context: Context,
    heading: string,
    getBirthdays: () => Promise<FamilyBirthday[]>,
  ): Promise<void> {
    const birthdays = await getBirthdays();

    if (birthdays.length === 0) {
      await context.reply(`${heading}\n\nНемає записів.`);
      return;
    }

    await this.replyInChunks(context, [
      heading,
      ...birthdays.map((birthday) => `• ${this.formatBirthday(birthday)}`),
    ]);
  }

  private async showInfo(context: Context): Promise<void> {
    if (!(await this.hasActivePrivateAccess(context))) {
      return;
    }

    await context.reply(
      'ℹ️ Family Circle показує події на сьогодні, усі дні народження та дні народження поточного місяця. Дані доступні лише підтвердженим учасникам сім’ї.',
    );
  }

  private async hasActivePrivateAccess(context: Context): Promise<boolean> {
    if (context.chat?.type !== 'private' || context.from === undefined) {
      return false;
    }

    const access = await this.telegramAccessService.resolveAccess(
      String(context.from.id),
    );

    if (access.kind === 'ACTIVE') {
      return true;
    }

    await context.reply('Відкрийте /start, щоб перевірити стан доступу.');
    return false;
  }

  private formatTodayEvent(event: FamilyCalendarEvent): string {
    return event.summary;
  }

  private formatBirthday(birthday: FamilyBirthday): string {
    const date = new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Kyiv',
    }).format(new Date(`${birthday.startsOn}T12:00:00.000Z`));
    return `${date} — ${birthday.name}`;
  }

  private async replyInChunks(
    context: Context,
    lines: string[],
  ): Promise<void> {
    const messages: string[] = [];
    let message = '';

    for (const line of lines) {
      const nextMessage = message.length === 0 ? line : `${message}\n${line}`;

      if (nextMessage.length > MAX_MESSAGE_LENGTH && message.length > 0) {
        messages.push(message);
        message = line;
        continue;
      }

      message = nextMessage;
    }

    if (message.length > 0) {
      messages.push(message);
    }

    for (const text of messages) {
      await context.reply(text);
    }
  }

  private logCalendarError(error: unknown): void {
    const details = error instanceof Error ? error.stack : String(error);
    this.logger.error('Failed to read member calendar data.', details);
  }
}
