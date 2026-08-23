import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import { FamilyAssistant } from '../assistant/application/family-assistant';
import { TelegramAccessService } from '../users/application/telegram-access.service';

@Injectable()
export class TelegramAssistantHandler {
  private readonly logger = new Logger(TelegramAssistantHandler.name);

  constructor(
    private readonly familyAssistant: FamilyAssistant,
    private readonly telegramAccessService: TelegramAccessService,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command('ask', (context) => this.handleAsk(context));
    bot.on('message:text', (context) => this.handleTextMessage(context));
    bot.callbackQuery('menu:assistant', (context) => this.showUsage(context));
  }

  private async handleAsk(context: Context): Promise<void> {
    const question = this.getQuestion(context);

    if (question === null) {
      if (await this.hasActivePrivateAccess(context)) {
        await this.replyUsage(context);
      }
      return;
    }

    await this.answerQuestion(context, question);
  }

  private async handleTextMessage(context: Context): Promise<void> {
    const text = context.message?.text;

    if (text === undefined) {
      return;
    }

    const question = text.trim();

    if (question.startsWith('/')) {
      return;
    }

    await this.answerQuestion(context, question);
  }

  private async answerQuestion(
    context: Context,
    question: string,
  ): Promise<void> {
    if (!(await this.hasActivePrivateAccess(context))) {
      return;
    }

    try {
      const answer = await this.familyAssistant.answer(question);
      await context.reply(answer);
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.error('Family assistant request failed.', details);
      await context.reply(
        'Не вдалося отримати відповідь помічника. Спробуйте трохи пізніше.',
      );
    }
  }

  private async showUsage(context: Context): Promise<void> {
    await context.answerCallbackQuery();

    if (!(await this.hasActivePrivateAccess(context))) {
      return;
    }

    await this.replyUsage(context);
  }

  private async hasActivePrivateAccess(context: Context): Promise<boolean> {
    if (context.chat?.type !== 'private' || context.from === undefined) {
      return false;
    }

    const access = await this.telegramAccessService.resolveAccess(
      String(context.from.id),
    );

    if (access.kind === 'ACTIVE') {
      return true;
    }

    await context.reply('Відкрийте /start, щоб перевірити стан доступу.');
    return false;
  }

  private getQuestion(context: Context): string | null {
    const text = context.message?.text;

    if (text === undefined) {
      return null;
    }

    const question = text.replace(/^\/ask(?:@[A-Za-z0-9_]+)?\s*/u, '').trim();
    return question.length === 0 ? null : question;
  }

  private async replyUsage(context: Context): Promise<void> {
    await context.reply(
      'Напишіть питання звичайним повідомленням. Наприклад:\n\nЩо сьогодні?\nУ кого день народження цього місяця?\nЯкі події в суботу?',
    );
  }
}
