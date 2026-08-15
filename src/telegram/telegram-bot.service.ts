import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotError, Context } from 'grammy';
import { TelegramCalendarHandler } from './telegram-calendar.handler';
import { TelegramUpdatesHandler } from './telegram-updates.handler';

@Injectable()
export class TelegramBotService implements OnApplicationShutdown {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot?: Bot<Context>;

  constructor(
    private readonly configService: ConfigService,
    private readonly updatesHandler: TelegramUpdatesHandler,
    private readonly calendarHandler: TelegramCalendarHandler,
  ) {}

  async start(): Promise<void> {
    if (this.bot?.isRunning()) {
      return;
    }

    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const bot = new Bot<Context>(token);

    this.updatesHandler.register(bot);
    this.calendarHandler.register(bot);
    bot.catch((error: BotError<Context>) => {
      const cause = error.error;
      const details = cause instanceof Error ? cause.stack : String(cause);
      this.logger.error('Telegram update processing failed.', details);
    });

    await bot.init();
    this.bot = bot;

    void bot
      .start({
        onStart: (botInfo) => {
          this.logger.log(`Long polling started for @${botInfo.username}.`);
        },
      })
      .catch((error: unknown) => {
        const details = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          'Telegram long polling stopped unexpectedly.',
          details,
        );
      });
  }

  onApplicationShutdown(): void {
    void this.bot?.stop();
  }

  async sendMessage(chatId: bigint, text: string): Promise<void> {
    if (this.bot === undefined) {
      throw new ServiceUnavailableException('Telegram bot is not started.');
    }

    await this.bot.api.sendMessage(chatId.toString(), text);
  }

  isRunning(): boolean {
    return this.bot?.isRunning() ?? false;
  }
}
