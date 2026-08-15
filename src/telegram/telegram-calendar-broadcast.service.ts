import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CalendarDeliveriesService } from '../calendar/application/calendar-deliveries.service';
import { FamilyCalendarService } from '../calendar/application/family-calendar.service';
import { FamilyCalendarEvent } from '../calendar/infrastructure/google-calendar.service';
import { FamilyGroupsService } from '../families/application/family-groups.service';
import { TelegramBotService } from './telegram-bot.service';

const KYIV_TIME_ZONE = 'Europe/Kyiv';

@Injectable()
export class TelegramCalendarBroadcastService {
  private readonly logger = new Logger(TelegramCalendarBroadcastService.name);

  constructor(
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly familyCalendarService: FamilyCalendarService,
    private readonly calendarDeliveriesService: CalendarDeliveriesService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  @Cron('0 8 * * *', { timeZone: KYIV_TIME_ZONE })
  async publishToday(now: Date = new Date()): Promise<void> {
    const groups = await this.familyGroupsService.listWithConnectedCalendar();

    for (const group of groups) {
      try {
        const calendar =
          await this.familyCalendarService.listTodayForTelegramChatId(
            group.telegramChatId,
            now,
          );

        for (const event of calendar.events) {
          await this.publishEvent(group.id, group.telegramChatId, event);
        }
      } catch (error: unknown) {
        const details = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Failed to publish calendar events for family group ${group.id}.`,
          details,
        );
      }
    }
  }

  private async publishEvent(
    familyGroupId: string,
    telegramChatId: bigint,
    event: FamilyCalendarEvent,
  ): Promise<void> {
    const wasClaimed = await this.calendarDeliveriesService.claimDelivery(
      familyGroupId,
      event.id,
      event.startsOn,
    );

    if (!wasClaimed) {
      return;
    }

    try {
      await this.telegramBotService.sendMessage(
        telegramChatId,
        `🕊 ${event.summary}`,
      );
    } catch (error: unknown) {
      await this.calendarDeliveriesService.releaseClaim(
        familyGroupId,
        event.id,
        event.startsOn,
      );
      throw error;
    }
  }
}
