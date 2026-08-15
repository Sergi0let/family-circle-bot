import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarConnectionsService } from './application/calendar-connections.service';
import { CalendarDeliveriesService } from './application/calendar-deliveries.service';
import { FamilyCalendarService } from './application/family-calendar.service';
import { GoogleCalendarService } from './infrastructure/google-calendar.service';

@Module({
  imports: [FamiliesModule, PrismaModule],
  providers: [
    CalendarConnectionsService,
    CalendarDeliveriesService,
    FamilyCalendarService,
    GoogleCalendarService,
  ],
  exports: [
    CalendarConnectionsService,
    CalendarDeliveriesService,
    FamilyCalendarService,
  ],
})
export class CalendarModule {}
