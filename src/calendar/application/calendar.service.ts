import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FamilyCalendarEvent,
  GoogleCalendarService,
} from '../infrastructure/google-calendar.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async listToday(now: Date = new Date()): Promise<FamilyCalendarEvent[]> {
    return this.googleCalendarService.listEventsForToday(
      this.getCalendarId(),
      now,
    );
  }

  async assertReadable(): Promise<void> {
    await this.googleCalendarService.assertReadable(this.getCalendarId());
  }

  private getCalendarId(): string {
    return this.configService.getOrThrow<string>('GOOGLE_CALENDAR_ID');
  }
}
