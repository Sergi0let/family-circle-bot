import { Module } from '@nestjs/common';
import { CalendarService } from './application/calendar.service';
import { GoogleCalendarService } from './infrastructure/google-calendar.service';

@Module({
  providers: [CalendarService, GoogleCalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
