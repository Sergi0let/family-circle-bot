import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { confirmedWrite } from '../families/application/confirmed-write';
import { FamilyGroupsService } from '../families/application/family-groups.service';

const ACTIVATE_FAMILY_GROUP_CALLBACK = 'family-group:activate';

@Injectable()
export class TelegramUpdatesHandler {
  private readonly logger = new Logger(TelegramUpdatesHandler.name);

  constructor(private readonly familyGroupsService: FamilyGroupsService) {}

  register(bot: Bot<Context>): void {
    bot.command('start', (context) => this.handleStart(context));
    bot.callbackQuery(ACTIVATE_FAMILY_GROUP_CALLBACK, (context) =>
      this.handleGroupActivation(context),
    );
  }

  async handleStart(context: Context): Promise<void> {
    const chat = context.chat;

    if (
      chat === undefined ||
      (chat.type !== 'group' && chat.type !== 'supergroup')
    ) {
      await context.reply(
        'Додай мене до сімейної групи та виконай /start саме там.',
      );
      return;
    }

    const keyboard = new InlineKeyboard().text(
      'Активувати Family Circle',
      ACTIVATE_FAMILY_GROUP_CALLBACK,
    );

    await context.reply(
      'Показуватиму свята з підключеного Google Calendar. Підтвердь активацію цієї групи.',
      { reply_markup: keyboard },
    );
  }

  async handleGroupActivation(context: Context): Promise<void> {
    const chat = context.chat;

    if (
      chat === undefined ||
      (chat.type !== 'group' && chat.type !== 'supergroup')
    ) {
      await context.answerCallbackQuery({
        text: 'Активація доступна лише у групі.',
        show_alert: true,
      });
      return;
    }

    if (!(await this.isGroupAdministrator(context, chat.id))) {
      await context.answerCallbackQuery({
        text: 'Активувати групу може лише адміністратор.',
        show_alert: true,
      });
      return;
    }

    const familyGroup = await this.familyGroupsService.register(
      confirmedWrite({
        telegramChatId: BigInt(chat.id),
        title: chat.title,
      }),
    );

    await context.answerCallbackQuery({
      text: 'Групу активовано.',
    });
    await context.editMessageText(
      `Family Circle активовано для «${familyGroup.title}».\n\nПідключи календар: /calendar_connect ID_календаря`,
    );
    this.logger.log(`Activated family group ${familyGroup.id}.`);
  }

  private async isGroupAdministrator(
    context: Context,
    chatId: number,
  ): Promise<boolean> {
    const user = context.from;

    if (user === undefined) {
      return false;
    }

    try {
      const member = await context.api.getChatMember(chatId, user.id);
      return member.status === 'administrator' || member.status === 'creator';
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.warn(
        'Could not verify the Telegram administrator role.',
        details,
      );
      return false;
    }
  }
}
