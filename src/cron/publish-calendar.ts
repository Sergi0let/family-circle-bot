import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { TelegramCalendarBroadcastService } from '../telegram/telegram-calendar-broadcast.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    await app.get(TelegramBotService).initialize();
    await app.get(TelegramCalendarBroadcastService).publishIfKyivMorning();
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  const details = error instanceof Error ? error.stack : String(error);
  Logger.error(
    'Calendar broadcast job failed.',
    details,
    'CalendarBroadcastJob',
  );
  process.exitCode = 1;
});
