import { Module } from '@nestjs/common';
import { AccessRequestsModule } from '../access-requests/access-requests.module';
import { AssistantModule } from '../assistant/assistant.module';
import { CalendarModule } from '../calendar/calendar.module';
import { GreetingsModule } from '../greetings/greetings.module';
import { UsersModule } from '../users/users.module';
import { TelegramAccessRequestNotifierService } from './telegram-access-request-notifier.service';
import { TelegramAccessRequestsHandler } from './telegram-access-requests.handler';
import { TelegramAssistantHandler } from './telegram-assistant.handler';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCalendarBroadcastService } from './telegram-calendar-broadcast.service';
import { TelegramCalendarHandler } from './telegram-calendar.handler';
import { TelegramMemberMenuHandler } from './telegram-member-menu.handler';
import { TelegramUserAdministrationHandler } from './telegram-user-administration.handler';
import { TelegramUpdatesHandler } from './telegram-updates.handler';
import { TelegramWebhookController } from './telegram-webhook.controller';

@Module({
  imports: [
    AccessRequestsModule,
    AssistantModule,
    CalendarModule,
    GreetingsModule,
    UsersModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramBotService,
    TelegramAssistantHandler,
    TelegramUpdatesHandler,
    TelegramCalendarHandler,
    TelegramMemberMenuHandler,
    TelegramCalendarBroadcastService,
    TelegramAccessRequestNotifierService,
    TelegramAccessRequestsHandler,
    TelegramUserAdministrationHandler,
  ],
  exports: [TelegramBotService, TelegramCalendarBroadcastService],
})
export class TelegramModule {}
