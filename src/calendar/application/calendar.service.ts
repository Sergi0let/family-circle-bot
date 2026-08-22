import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import { FamilyBirthday, toFamilyBirthday } from './family-birthday';
import { FamilyCalendarEvent } from './family-calendar-event';

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

  async listBirthdays(now: Date = new Date()): Promise<FamilyBirthday[]> {
    const year = this.getCalendarYear(now);
    const events = await this.googleCalendarService.listEventsInDateRange(
      this.getCalendarId(),
      `${year}-01-01`,
      `${year + 1}-01-01`,
      'family',
    );

    return events
      .map(toFamilyBirthday)
      .filter((birthday): birthday is FamilyBirthday => birthday !== null)
      .sort((left, right) => left.startsOn.localeCompare(right.startsOn));
  }

  async listBirthdaysThisMonth(
    now: Date = new Date(),
  ): Promise<FamilyBirthday[]> {
    const month = this.getCalendarMonth(now);
    const birthdays = await this.listBirthdays(now);

    return birthdays.filter(
      (birthday) => birthday.startsOn.slice(5, 7) === month,
    );
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

  private getCalendarYear(now: Date): number {
    return Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: this.configService.get<string>(
          'GOOGLE_CALENDAR_TIME_ZONE',
          'Europe/Kyiv',
        ),
        year: 'numeric',
      }).format(now),
    );
  }

  private getCalendarMonth(now: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.configService.get<string>(
        'GOOGLE_CALENDAR_TIME_ZONE',
        'Europe/Kyiv',
      ),
      month: '2-digit',
    }).format(now);
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
