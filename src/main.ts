import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TelegramBotService } from './telegram/telegram-bot.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.get(TelegramBotService).start();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
