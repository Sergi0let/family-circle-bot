import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { CalendarModule } from '../calendar/calendar.module';
import { PendingCalendarConnectionStore } from './pending-calendar-connection.store';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCalendarBroadcastService } from './telegram-calendar-broadcast.service';
import { TelegramCalendarHandler } from './telegram-calendar.handler';
import { TelegramUpdatesHandler } from './telegram-updates.handler';

@Module({
  imports: [FamiliesModule, CalendarModule],
  providers: [
    TelegramBotService,
    TelegramUpdatesHandler,
    TelegramCalendarHandler,
    PendingCalendarConnectionStore,
    TelegramCalendarBroadcastService,
  ],
  exports: [TelegramBotService],
})
export class TelegramModule {}
