import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FamilyCalendarEvent } from './family-calendar-event';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';

interface CalendarSource {
  readonly calendarId: string;
  readonly source: FamilyCalendarEvent['source'];
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async listToday(now: Date = new Date()): Promise<FamilyCalendarEvent[]> {
    const eventGroups = await Promise.all(
      this.getCalendarSources().map(({ calendarId, source }) =>
        this.googleCalendarService.listEventsForToday(calendarId, now, source),
      ),
    );

    return eventGroups.flat();
  }

  async assertReadable(): Promise<void> {
    await Promise.all(
      this.getCalendarSources().map(({ calendarId }) =>
        this.googleCalendarService.assertReadable(calendarId),
      ),
    );
  }

  private getCalendarId(): string {
    return this.configService.getOrThrow<string>('GOOGLE_CALENDAR_ID');
  }

  private getPublicHolidaysCalendarId(): string | undefined {
    return this.configService.get<string>('GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID');
  }

  private getCalendarSources(): readonly CalendarSource[] {
    const familyCalendar: CalendarSource = {
      calendarId: this.getCalendarId(),
      source: 'family',
    };
    const publicHolidaysCalendarId = this.getPublicHolidaysCalendarId();

    if (publicHolidaysCalendarId === undefined) {
      return [familyCalendar];
    }

    return [
      familyCalendar,
      {
        calendarId: publicHolidaysCalendarId,
        source: 'public-holidays',
      },
    ];
  }
}
