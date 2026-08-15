import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import type { Update } from 'grammy/types';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleUpdate(
    @Body() update: Update,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<void> {
    await this.telegramBotService.handleWebhookUpdate(update, secretToken);
  }
}
