import { Module } from '@nestjs/common';
import { FamiliesModule } from '../families/families.module';
import { CalendarModule } from '../calendar/calendar.module';
import { PendingCalendarConnectionStore } from './pending-calendar-connection.store';
import { PendingMemberAdditionStore } from './pending-member-addition.store';
import { TelegramBirthdaysHandler } from './telegram-birthdays.handler';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCalendarHandler } from './telegram-calendar.handler';
import { TelegramMemberAddHandler } from './telegram-member-add.handler';
import { TelegramUpdatesHandler } from './telegram-updates.handler';

@Module({
  imports: [FamiliesModule, CalendarModule],
  providers: [
    TelegramBotService,
    TelegramUpdatesHandler,
    TelegramMemberAddHandler,
    TelegramBirthdaysHandler,
    TelegramCalendarHandler,
    PendingMemberAdditionStore,
    PendingCalendarConnectionStore,
  ],
  exports: [TelegramBotService],
})
export class TelegramModule {}
