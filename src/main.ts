import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { TelegramBotService } from './telegram/telegram-bot.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const expressApp = app.getHttpAdapter().getInstance() as unknown as Pick<
    Express,
    'disable'
  >;
  expressApp.disable('x-powered-by');
  const telegramBotService = app.get(TelegramBotService);
  await telegramBotService.initialize();
  const configService = app.get(ConfigService);
  await app.listen(
    configService.getOrThrow<number>('PORT'),
    configService.getOrThrow<string>('HOST'),
  );
  await telegramBotService.activateTransport();
}
void bootstrap();
