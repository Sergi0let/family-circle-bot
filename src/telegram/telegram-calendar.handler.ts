import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { CalendarConnectionsService } from '../calendar/application/calendar-connections.service';
import { FamilyCalendarService } from '../calendar/application/family-calendar.service';
import { confirmedWrite } from '../families/application/confirmed-write';
import { FamilyGroupsService } from '../families/application/family-groups.service';
import { PendingCalendarConnectionStore } from './pending-calendar-connection.store';

const CALENDAR_CONNECT_CALLBACK_PATTERN =
  /^calendar-connect:(confirm|cancel):([0-9a-f-]{36})$/u;
const CALENDAR_CONNECT_USAGE =
  'Використання: /calendar_connect ID_календаря\n\nID знайдеш у Google Calendar: Налаштування календаря → Інтеграція календаря → Ідентифікатор календаря.';
const REMOVE_LEGACY_KEYBOARD = { remove_keyboard: true } as const;

@Injectable()
export class TelegramCalendarHandler {
  private readonly logger = new Logger(TelegramCalendarHandler.name);

  constructor(
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly calendarConnectionsService: CalendarConnectionsService,
    private readonly familyCalendarService: FamilyCalendarService,
    private readonly pendingConnections: PendingCalendarConnectionStore,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command('calendar_connect', (context) =>
      this.handleCalendarConnect(context),
    );
    bot.command('calendar_today', (context) =>
      this.handleCalendarToday(context),
    );
    bot.callbackQuery(CALENDAR_CONNECT_CALLBACK_PATTERN, (context) =>
      this.handleCalendarConnectionCallback(context),
    );
  }

  async handleCalendarConnect(context: Context): Promise<void> {
    const chat = this.getGroupChat(context);
    const user = context.from;
    const calendarId = this.getCommandArguments(context);

    if (chat === null || user === undefined) {
      await this.reply(context, 'Ця команда доступна лише у сімейній групі.');
      return;
    }

    if (calendarId.length === 0) {
      await this.reply(context, CALENDAR_CONNECT_USAGE);
      return;
    }

    if (!(await this.isGroupAdministrator(context, chat.id))) {
      await this.reply(
        context,
        'Підключити або змінити календар може лише адміністратор групи.',
      );
      return;
    }

    const familyGroup = await this.familyGroupsService.findByTelegramChatId(
      BigInt(chat.id),
    );

    if (familyGroup === null) {
      await this.reply(context, 'Спочатку активуй групу командою /start.');
      return;
    }

    const draft = this.pendingConnections.create({
      chatId: chat.id,
      requestedByUserId: user.id,
      input: {
        familyGroupId: familyGroup.id,
        googleCalendarId: calendarId,
      },
    });
    const keyboard = new InlineKeyboard()
      .text('Підтвердити', `calendar-connect:confirm:${draft.id}`)
      .text('Скасувати', `calendar-connect:cancel:${draft.id}`);

    await this.reply(
      context,
      [
        'Чернетка підключення Google Calendar:',
        `Календар: ${calendarId}`,
        '',
        'Після підтвердження бот лише перевірить і читатиме події цього календаря.',
      ].join('\n'),
      keyboard,
    );
  }

  async handleCalendarToday(context: Context): Promise<void> {
    const chat = this.getGroupChat(context);

    if (chat === null) {
      await this.reply(context, 'Ця команда доступна лише у сімейній групі.');
      return;
    }

    try {
      const calendar =
        await this.familyCalendarService.listTodayForTelegramChatId(
          BigInt(chat.id),
        );

      if (!calendar.isKnownGroup) {
        await this.reply(context, 'Спочатку активуй групу командою /start.');
        return;
      }

      if (!calendar.isConnected) {
        await this.reply(
          context,
          `Google Calendar ще не підключено.\n\n${CALENDAR_CONNECT_USAGE}`,
        );
        return;
      }

      if (calendar.events.length === 0) {
        await this.reply(
          context,
          'На сьогодні подій у сімейному календарі немає.',
        );
        return;
      }

      for (const event of calendar.events) {
        await this.reply(context, `🕊 ${event.summary}`);
      }
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to read Google Calendar events.', details);
      await this.reply(
        context,
        'Не вдалося прочитати Google Calendar. Перевір, що календар поширено для service account із роллю Reader.',
      );
    }
  }

  async handleCalendarConnectionCallback(context: Context): Promise<void> {
    const chat = this.getGroupChat(context);
    const user = context.from;
    const callbackData = context.callbackQuery?.data;
    const match = callbackData?.match(CALENDAR_CONNECT_CALLBACK_PATTERN);

    if (
      chat === null ||
      user === undefined ||
      match === null ||
      match === undefined
    ) {
      await context.answerCallbackQuery({
        text: 'Не вдалося обробити підтвердження.',
        show_alert: true,
      });
      return;
    }

    if (!(await this.isGroupAdministrator(context, chat.id))) {
      await context.answerCallbackQuery({
        text: 'Підтвердити підключення може лише адміністратор групи.',
        show_alert: true,
      });
      return;
    }

    const [, action, draftId] = match;
    const draft = this.pendingConnections.get(draftId);

    if (
      draft === null ||
      draft.chatId !== chat.id ||
      draft.requestedByUserId !== user.id
    ) {
      await context.answerCallbackQuery({
        text: 'Чернетка вже недійсна або належить іншому учаснику.',
        show_alert: true,
      });
      return;
    }

    if (action === 'cancel') {
      this.pendingConnections.discard(draftId);
      await context.answerCallbackQuery({ text: 'Підключення скасовано.' });
      await context.editMessageText('Підключення Google Calendar скасовано.');
      return;
    }

    const confirmedDraft = this.pendingConnections.consume(draftId);

    if (confirmedDraft === null) {
      await context.answerCallbackQuery({
        text: 'Чернетка вже недійсна. Створи її ще раз.',
        show_alert: true,
      });
      return;
    }

    try {
      await this.calendarConnectionsService.connectGoogleCalendar(
        confirmedWrite(confirmedDraft.input),
      );
      await context.answerCallbackQuery({ text: 'Календар підключено.' });
      await context.editMessageText(
        'Google Calendar підключено. Перевір події командою /calendar_today.',
      );
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to connect Google Calendar.', details);
      await context.answerCallbackQuery({
        text: 'Не вдалося підключити календар.',
        show_alert: true,
      });
      await context.editMessageText(
        'Не вдалося підключити календар. Перевір ID календаря, налаштування service account і доступ Reader.',
      );
    }
  }

  private getGroupChat(
    context: Context,
  ): { readonly id: number; readonly title: string } | null {
    const chat = context.chat;

    if (
      chat === undefined ||
      (chat.type !== 'group' && chat.type !== 'supergroup')
    ) {
      return null;
    }

    return chat;
  }

  private getCommandArguments(context: Context): string {
    const text = context.message?.text;

    if (text === undefined) {
      return '';
    }

    const command = /^\/calendar_connect(?:@\w+)?(?:\s+|$)/u.exec(text);
    return command === null ? '' : text.slice(command[0].length).trim();
  }

  private async isGroupAdministrator(
    context: Context,
    chatId: number,
  ): Promise<boolean> {
    const user = context.from;

    if (user === undefined) {
      return false;
    }

    try {
      const member = await context.api.getChatMember(chatId, user.id);
      return member.status === 'administrator' || member.status === 'creator';
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.warn(
        'Could not verify the Telegram administrator role.',
        details,
      );
      return false;
    }
  }

  private async reply(
    context: Context,
    text: string,
    inlineKeyboard?: InlineKeyboard,
  ): Promise<void> {
    await context.reply(text, {
      reply_markup: inlineKeyboard ?? REMOVE_LEGACY_KEYBOARD,
    });
  }
}
