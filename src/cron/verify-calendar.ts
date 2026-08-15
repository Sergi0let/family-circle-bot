import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CalendarService } from '../calendar/application/calendar.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    await app.get(CalendarService).assertReadable();
    Logger.log('Google Calendar access verified.', 'CalendarVerificationJob');
  } finally {
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  const details = error instanceof Error ? error.stack : String(error);
  Logger.error(
    'Calendar verification job failed.',
    details,
    'CalendarVerificationJob',
  );
  process.exitCode = 1;
});
