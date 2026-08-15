import { Injectable } from '@nestjs/common';
import { FamilyGroupsService } from '../../families/application/family-groups.service';
import {
  FamilyCalendarEvent,
  GoogleCalendarService,
} from '../infrastructure/google-calendar.service';

export interface TodayFamilyCalendar {
  readonly events: FamilyCalendarEvent[];
  readonly isConnected: boolean;
  readonly isKnownGroup: boolean;
}

@Injectable()
export class FamilyCalendarService {
  constructor(
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async listTodayForTelegramChatId(
    telegramChatId: bigint,
    now: Date = new Date(),
  ): Promise<TodayFamilyCalendar> {
    const familyGroup =
      await this.familyGroupsService.findByTelegramChatId(telegramChatId);

    if (familyGroup === null) {
      return { events: [], isConnected: false, isKnownGroup: false };
    }

    if (familyGroup.googleCalendarId === null) {
      return { events: [], isConnected: false, isKnownGroup: true };
    }

    const events = await this.googleCalendarService.listEventsForToday(
      familyGroup.googleCalendarId,
      now,
    );

    return { events, isConnected: true, isKnownGroup: true };
  }
}
