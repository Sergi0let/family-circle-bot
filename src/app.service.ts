import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { TelegramBotService } from './telegram/telegram-bot.service';

@Injectable()
export class AppService {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  getHello(): string {
    return 'Family Circle Bot';
  }

  getHealth(): { readonly status: 'ok' } {
    if (!this.telegramBotService.isReady()) {
      throw new ServiceUnavailableException('Telegram bot is not ready.');
    }

    return { status: 'ok' };
  }
}
