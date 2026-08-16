import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../calendar/application/calendar.service';
import { FamilyCalendarEvent } from '../calendar/application/family-calendar-event';
import { toGreetingGenerationInput } from '../greetings/application/greeting-event-classifier';
import {
  GreetingGenerationInput,
  GreetingGenerator,
} from '../greetings/application/greeting-generator';
import { TelegramBotService } from './telegram-bot.service';

const KYIV_TIME_ZONE = 'Europe/Kyiv';
const KYIV_BROADCAST_HOUR = 9;

@Injectable()
export class TelegramCalendarBroadcastService {
  private readonly logger = new Logger(TelegramCalendarBroadcastService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly calendarService: CalendarService,
    private readonly greetingGenerator: GreetingGenerator,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async publishIfKyivScheduledTime(now: Date = new Date()): Promise<boolean> {
    if (!this.isKyivBroadcastHour(now)) {
      this.logger.log(
        'Skipping calendar broadcast outside the Kyiv 09:00 hour.',
      );
      return false;
    }

    const events = await this.calendarService.listToday(now);
    const chatId = this.configService.getOrThrow<string>('TELEGRAM_CHAT_ID');

    let published = 0;

    for (const event of events) {
      const greeting = toGreetingGenerationInput(event);

      if (greeting === null) {
        this.logger.warn(`Skipping unclassified calendar event ${event.id}.`);
        continue;
      }

      const text = await this.getGreetingText(event, greeting);
      await this.telegramBotService.sendMessage(chatId, `🕊 ${text}`);
      published += 1;
    }

    this.logger.log(`Published ${published} greeting(s).`);
    return true;
  }

  private isKyivBroadcastHour(value: Date): boolean {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: KYIV_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);

    const hour = parts.find((part) => part.type === 'hour')?.value;

    if (hour === undefined) {
      throw new Error('Could not determine the current Kyiv hour.');
    }

    return Number(hour) === KYIV_BROADCAST_HOUR;
  }

  private async getGreetingText(
    event: FamilyCalendarEvent,
    greeting: GreetingGenerationInput,
  ): Promise<string> {
    try {
      return (await this.greetingGenerator.generate(greeting)).text;
    } catch {
      this.logger.warn(
        `Claude greeting generation failed for ${event.id}; using fallback.`,
      );

      if (greeting.kind === 'birthday') {
        return `${greeting.recipientName}, вітаємо з Днем народження!`;
      }

      return `Зі святом: ${greeting.occasion}.`;
    }
  }
}
