import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { CalendarService } from '../calendar/application/calendar.service';

@Injectable()
export class TelegramCalendarHandler {
  private readonly logger = new Logger(TelegramCalendarHandler.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly calendarService: CalendarService,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command('calendar_today', (context) =>
      this.handleCalendarToday(context),
    );
  }

  async handleCalendarToday(context: Context): Promise<void> {
    if (!this.isConfiguredGroup(context)) {
      await context.reply(
        'Ця команда доступна лише у налаштованій сімейній групі.',
      );
      return;
    }

    try {
      const events = await this.calendarService.listToday();

      if (events.length === 0) {
        await context.reply('На сьогодні подій у сімейному календарі немає.');
        return;
      }

      for (const event of events) {
        await context.reply(`🕊 ${event.summary}`);
      }
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to read Google Calendar events.', details);
      await context.reply(
        'Не вдалося прочитати Google Calendar. Перевір доступ service account із роллю Reader.',
      );
    }
  }

  private isConfiguredGroup(context: Context): boolean {
    const chat = context.chat;

    return (
      chat !== undefined &&
      (chat.type === 'group' || chat.type === 'supergroup') &&
      String(chat.id) ===
        this.configService.getOrThrow<string>('TELEGRAM_CHAT_ID')
    );
  }
}
