import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { AccessRequestsService } from '../access-requests/application/access-requests.service';

type ModerationDecision = 'approve' | 'reject';

@Injectable()
export class TelegramAccessRequestsHandler {
  private readonly logger = new Logger(TelegramAccessRequestsHandler.name);

  constructor(private readonly accessRequestsService: AccessRequestsService) {}

  register(bot: Bot<Context>): void {
    bot.callbackQuery(
      /^access-request:([a-z0-9]+):(approve|reject)$/u,
      (context) =>
        this.showDecisionConfirmation(
          context,
          context.match[1],
          context.match[2] as ModerationDecision,
        ),
    );
    bot.callbackQuery(
      /^access-request:([a-z0-9]+):(approve|reject):confirm$/u,
      (context) =>
        this.decide(
          context,
          context.match[1],
          context.match[2] as ModerationDecision,
        ),
    );
    bot.callbackQuery(
      /^access-request:([a-z0-9]+):(approve|reject):cancel$/u,
      (context) => this.cancelDecision(context),
    );
  }

  private async showDecisionConfirmation(
    context: Context,
    requestId: string,
    decision: ModerationDecision,
  ): Promise<void> {
    await context.answerCallbackQuery();

    if (!this.isPrivateActor(context)) {
      return;
    }

    try {
      const request = await this.accessRequestsService.getPendingForModerator(
        requestId,
        String(context.from.id),
      );
      const applicantName = request.applicant.firstName ?? 'цього користувача';
      const action = decision === 'approve' ? 'прийняти' : 'відхилити';

      await context.reply(`Підтвердити: ${action} ${applicantName}?`, {
        reply_markup: new InlineKeyboard()
          .text(
            decision === 'approve' ? '✅ Так, прийняти' : '❌ Так, відхилити',
            `access-request:${requestId}:${decision}:confirm`,
          )
          .text(
            '↩️ Скасувати',
            `access-request:${requestId}:${decision}:cancel`,
          ),
      });
    } catch (error: unknown) {
      this.logModerationError(error, requestId);
      await context.reply(
        'Заявку вже опрацьовано або доступ до неї відсутній.',
      );
    }
  }

  private async decide(
    context: Context,
    requestId: string,
    decision: ModerationDecision,
  ): Promise<void> {
    await context.answerCallbackQuery();

    if (!this.isPrivateActor(context)) {
      return;
    }

    try {
      const request =
        decision === 'approve'
          ? await this.accessRequestsService.approve(
              requestId,
              String(context.from.id),
            )
          : await this.accessRequestsService.reject(
              requestId,
              String(context.from.id),
            );
      const approved = decision === 'approve';

      await context.reply(
        approved
          ? '✅ Доступ користувачу підтверджено.'
          : '❌ Заявку користувача відхилено.',
      );
      await this.notifyApplicant(context, request, approved);
    } catch (error: unknown) {
      this.logModerationError(error, requestId);
      await context.reply(
        'Не вдалося опрацювати заявку: її стан уже змінився.',
      );
    }
  }

  private async cancelDecision(context: Context): Promise<void> {
    await context.answerCallbackQuery('Дію скасовано.');
  }

  private isPrivateActor(context: Context): context is Context & {
    from: NonNullable<Context['from']>;
  } {
    return context.chat?.type === 'private' && context.from !== undefined;
  }

  private async notifyApplicant(
    context: Context,
    request: Awaited<ReturnType<AccessRequestsService['approve']>>,
    approved: boolean,
  ): Promise<void> {
    const privateChatId = request.applicant.privateChatId;

    if (privateChatId === null) {
      return;
    }

    try {
      await context.api.sendMessage(
        privateChatId,
        approved
          ? '✅ Ваш доступ до Family Circle підтверджено. Відкрийте меню кнопкою нижче.'
          : 'Вашу заявку до Family Circle не підтверджено.',
        approved
          ? {
              reply_markup: new InlineKeyboard().text(
                '▶️ Відкрити меню',
                'menu:open',
              ),
            }
          : undefined,
      );
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error);
      this.logger.error('Could not notify access-request applicant.', details);
    }
  }

  private logModerationError(error: unknown, requestId: string): void {
    const details = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Could not process access request ${requestId}: ${details}`,
    );
  }
}
