import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { GreetingsModule } from '../greetings/greetings.module';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCalendarBroadcastService } from './telegram-calendar-broadcast.service';
import { TelegramCalendarHandler } from './telegram-calendar.handler';
import { TelegramUpdatesHandler } from './telegram-updates.handler';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [CalendarModule, GreetingsModule],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramBotService,
    TelegramUpdatesHandler,
    TelegramCalendarHandler,
    TelegramCalendarBroadcastService,
  ],
  exports: [TelegramBotService, TelegramCalendarBroadcastService],
})
export class TelegramModule {}
