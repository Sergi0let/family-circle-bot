import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../calendar/application/calendar.service';
import { TelegramBotService } from './telegram-bot.service';

const KYIV_TIME_ZONE = 'Europe/Kyiv';

@Injectable()
export class TelegramCalendarBroadcastService {
  private readonly logger = new Logger(TelegramCalendarBroadcastService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly calendarService: CalendarService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async publishIfKyivMorning(now: Date = new Date()): Promise<boolean> {
    if (this.getKyivHour(now) !== 8) {
      this.logger.log(
        'Skipping calendar broadcast outside the Kyiv 08:00 hour.',
      );
      return false;
    }

    const events = await this.calendarService.listToday(now);
    const chatId = this.configService.getOrThrow<string>('TELEGRAM_CHAT_ID');

    for (const event of events) {
      await this.telegramBotService.sendMessage(chatId, `🕊 ${event.summary}`);
    }

    this.logger.log(`Published ${events.length} calendar event(s).`);
    return true;
  }

  private getKyivHour(value: Date): number {
    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone: KYIV_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(value)
      .find((part) => part.type === 'hour')?.value;

    if (hour === undefined) {
      throw new Error('Could not determine the current Kyiv hour.');
    }

    return Number(hour);
  }
}
