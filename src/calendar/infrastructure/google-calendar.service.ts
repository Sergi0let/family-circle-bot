import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3, google } from 'googleapis';
import { z } from 'zod';
import {
  CalendarEventSource,
  FamilyCalendarEvent,
} from '../application/family-calendar-event';

const GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE =
  'https://www.googleapis.com/auth/calendar.events.readonly';
const DEFAULT_TIME_ZONE = 'Europe/Kyiv';

const serviceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
});

@Injectable()
export class GoogleCalendarService {
  private client: calendar_v3.Calendar | null = null;

  constructor(private readonly configService: ConfigService) {}

  async assertReadable(calendarId: string): Promise<void> {
    await this.getClient().events.list({
      calendarId,
      maxResults: 1,
      singleEvents: true,
    });
  }

  async listEventsForToday(
    calendarId: string,
    now: Date,
    source: CalendarEventSource = 'family',
  ): Promise<FamilyCalendarEvent[]> {
    const timeZone = this.configService.get<string>(
      'GOOGLE_CALENDAR_TIME_ZONE',
      DEFAULT_TIME_ZONE,
    );
    const targetDate = this.getCalendarDate(now, timeZone);
    const rangeStart = new Date(`${targetDate}T00:00:00.000Z`);
    const rangeEnd = new Date(rangeStart);

    rangeStart.setUTCHours(rangeStart.getUTCHours() - 14);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
    rangeEnd.setUTCHours(rangeEnd.getUTCHours() + 14);

    const items: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getClient().events.list({
        calendarId,
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone,
        maxResults: 2500,
        pageToken,
      });
      items.push(...(response.data.items ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken !== undefined);

    return items
      .filter((event) => event.status !== 'cancelled')
      .map((event) => this.toFamilyCalendarEvent(event, timeZone, source))
      .filter(
        (event): event is FamilyCalendarEvent =>
          event !== null && event.startsOn === targetDate,
      );
  }

  private getClient(): calendar_v3.Calendar {
    if (this.client !== null) {
      return this.client;
    }

    const encodedCredentials = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64',
    );

    if (encodedCredentials === undefined || encodedCredentials.length === 0) {
      throw new ServiceUnavailableException(
        'Google Calendar integration is not configured.',
      );
    }

    let credentials: z.infer<typeof serviceAccountSchema>;

    try {
      const decodedCredentials = Buffer.from(
        encodedCredentials,
        'base64',
      ).toString('utf8');
      credentials = serviceAccountSchema.parse(JSON.parse(decodedCredentials));
    } catch {
      throw new ServiceUnavailableException(
        'Google Calendar service-account credentials are invalid.',
      );
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [GOOGLE_CALENDAR_EVENTS_READONLY_SCOPE],
    });
    this.client = google.calendar({ version: 'v3', auth });

    return this.client;
  }

  private getCalendarDate(value: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }

  private toFamilyCalendarEvent(
    event: calendar_v3.Schema$Event,
    timeZone: string,
    source: CalendarEventSource,
  ): FamilyCalendarEvent | null {
    if (
      event.id === undefined ||
      event.id === null ||
      event.start === undefined
    ) {
      return null;
    }

    const allDayDate = event.start.date;
    const dateTime = event.start.dateTime;

    if (
      (allDayDate === undefined || allDayDate === null) &&
      (dateTime === undefined || dateTime === null)
    ) {
      return null;
    }

    return {
      description: event.description?.trim() || null,
      id: event.id,
      iCalUID: event.iCalUID ?? null,
      source,
      summary: event.summary?.trim() || 'Подія без назви',
      startsOn:
        allDayDate ??
        this.getCalendarDate(new Date(dateTime as string), timeZone),
      isAllDay: allDayDate !== undefined && allDayDate !== null,
      htmlLink: event.htmlLink ?? null,
    };
  }
}
