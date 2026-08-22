import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Bot, BotError, Context, InlineKeyboard } from 'grammy';
import { TelegramAccessRequestsHandler } from './telegram-access-requests.handler';
import { Update } from 'grammy/types';
import { TelegramCalendarHandler } from './telegram-calendar.handler';
import { TelegramMemberMenuHandler } from './telegram-member-menu.handler';
import { TelegramUpdatesHandler } from './telegram-updates.handler';
import { TelegramUserAdministrationHandler } from './telegram-user-administration.handler';

const WEBHOOK_PATH = 'telegram/webhook';

@Injectable()
export class TelegramBotService implements OnApplicationShutdown {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot?: Bot<Context>;
  private webhookConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly updatesHandler: TelegramUpdatesHandler,
    private readonly calendarHandler: TelegramCalendarHandler,
    private readonly memberMenuHandler: TelegramMemberMenuHandler,
    private readonly accessRequestsHandler: TelegramAccessRequestsHandler,
    private readonly userAdministrationHandler: TelegramUserAdministrationHandler,
  ) {}

  async initialize(): Promise<void> {
    if (this.bot !== undefined) {
      return;
    }

    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const bot = new Bot<Context>(token);

    this.updatesHandler.register(bot);
    this.calendarHandler.register(bot);
    this.memberMenuHandler.register(bot);
    this.accessRequestsHandler.register(bot);
    this.userAdministrationHandler.register(bot);
    bot.catch((error: BotError<Context>) => {
      const cause = error.error;
      const details = cause instanceof Error ? cause.stack : String(cause);
      this.logger.error('Telegram update processing failed.', details);
    });

    await bot.init();
    this.bot = bot;
  }

  async activateTransport(): Promise<void> {
    const bot = this.getBot();
    const transport = this.configService.getOrThrow<'polling' | 'webhook'>(
      'TELEGRAM_TRANSPORT',
    );

    if (transport === 'webhook') {
      await bot.api.setWebhook(this.getWebhookUrl(), {
        secret_token: this.configService.getOrThrow<string>(
          'TELEGRAM_WEBHOOK_SECRET',
        ),
        allowed_updates: ['message', 'callback_query'],
      });
      this.webhookConfigured = true;
      this.logger.log('Telegram webhook configured.');
      return;
    }

    await bot.api.deleteWebhook({ drop_pending_updates: false });
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

  async handleWebhookUpdate(
    update: Update,
    secretToken: string | undefined,
  ): Promise<void> {
    if (!this.hasValidWebhookSecret(secretToken)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret.');
    }

    await this.getBot().handleUpdate(update);
  }

  onApplicationShutdown(): void {
    if (this.bot?.isRunning()) {
      void this.bot.stop();
    }
  }

  async sendMessage(
    chatId: string,
    text: string,
    replyMarkup?: InlineKeyboard,
  ): Promise<void> {
    await this.getBot().api.sendMessage(
      chatId,
      text,
      replyMarkup === undefined ? {} : { reply_markup: replyMarkup },
    );
  }

  isReady(): boolean {
    if (this.bot === undefined) {
      return false;
    }

    return this.configService.getOrThrow<'polling' | 'webhook'>(
      'TELEGRAM_TRANSPORT',
    ) === 'webhook'
      ? this.webhookConfigured
      : this.bot.isRunning();
  }

  private getBot(): Bot<Context> {
    if (this.bot === undefined) {
      throw new ServiceUnavailableException('Telegram bot is not initialized.');
    }

    return this.bot;
  }

  private getWebhookUrl(): string {
    const baseUrl = this.configService.getOrThrow<string>(
      'TELEGRAM_WEBHOOK_URL',
    );
    return new URL(WEBHOOK_PATH, `${baseUrl.replace(/\/$/u, '')}/`).toString();
  }

  private hasValidWebhookSecret(secretToken: string | undefined): boolean {
    const expectedSecret = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_SECRET',
    );

    if (expectedSecret === undefined || secretToken === undefined) {
      return false;
    }

    const expected = Buffer.from(expectedSecret);
    const actual = Buffer.from(secretToken);

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}
