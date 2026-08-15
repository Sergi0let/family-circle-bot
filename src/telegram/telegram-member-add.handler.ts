import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { confirmedWrite } from '../families/application/confirmed-write';
import {
  CreateFamilyMemberInput,
  FamilyMembersService,
} from '../families/application/family-members.service';
import { FamilyGroupsService } from '../families/application/family-groups.service';
import {
  memberAddInputSchema,
  parseMemberAddArguments,
} from './member-add.schema';
import { PendingMemberAdditionStore } from './pending-member-addition.store';
import { MEMBER_ADD_MENU_ACTION } from './telegram-menu';
import { replyWithFamilyMenu } from './telegram-menu';

const MEMBER_ADD_CALLBACK_PATTERN =
  /^member-add:(confirm|cancel):([0-9a-f-]{36})$/u;
const MEMBER_ADD_USAGE =
  'Використання: /member_add Імʼя; Прізвище; YYYY-MM-DD\nПрізвище необовʼязкове: /member_add Імʼя; YYYY-MM-DD';

@Injectable()
export class TelegramMemberAddHandler {
  private readonly logger = new Logger(TelegramMemberAddHandler.name);
  private readonly menuPrompts = new Map<
    string,
    { readonly messageId: number; readonly expiresAt: number }
  >();

  constructor(
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly familyMembersService: FamilyMembersService,
    private readonly pendingAdditions: PendingMemberAdditionStore,
  ) {}

  register(bot: Bot<Context>): void {
    bot.command('member_add', (context) => this.handleMemberAdd(context));
    bot.hears(MEMBER_ADD_MENU_ACTION, (context) =>
      this.handleMemberAddFromMenu(context),
    );
    bot.on('message:text', async (context, next) => {
      const wasHandled = await this.handleMenuReply(context);

      if (!wasHandled) {
        await next();
      }
    });
    bot.callbackQuery(MEMBER_ADD_CALLBACK_PATTERN, (context) =>
      this.handleMemberAdditionCallback(context),
    );
  }

  async handleMemberAdd(context: Context): Promise<void> {
    const chat = this.getGroupChat(context);
    const user = context.from;

    if (chat === null || user === undefined) {
      await context.reply('Ця команда доступна лише у сімейній групі.');
      return;
    }

    const familyGroup = await this.familyGroupsService.findByTelegramChatId(
      BigInt(chat.id),
    );

    if (familyGroup === null) {
      await context.reply('Спочатку активуй групу командою /start.');
      return;
    }

    const parsedInput = memberAddInputSchema.safeParse(
      parseMemberAddArguments(this.getCommandArguments(context)),
    );

    if (!parsedInput.success) {
      await context.reply(MEMBER_ADD_USAGE);
      return;
    }

    await this.createDraft(
      context,
      chat.id,
      user.id,
      familyGroup.id,
      parsedInput.data,
    );
  }

  async handleMemberAddFromMenu(context: Context): Promise<void> {
    const chat = this.getGroupChat(context);
    const user = context.from;

    if (chat === null || user === undefined) {
      await context.reply('Ця дія доступна лише у сімейній групі.');
      return;
    }

    const familyGroup = await this.familyGroupsService.findByTelegramChatId(
      BigInt(chat.id),
    );

    if (familyGroup === null) {
      await context.reply('Спочатку активуй групу командою /start.');
      return;
    }

    const prompt = await context.reply(
      'Напиши дані у відповідь на це повідомлення: Імʼя; Прізвище; YYYY-MM-DD\nПрізвище можна пропустити: Імʼя; YYYY-MM-DD',
      {
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Olena; Koval; 1990-05-14',
        },
      },
    );
    this.menuPrompts.set(this.getPromptKey(chat.id, user.id), {
      messageId: prompt.message_id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  }

  async handleMenuReply(context: Context): Promise<boolean> {
    const chat = this.getGroupChat(context);
    const user = context.from;
    const message = context.message;

    if (chat === null || user === undefined || message?.text === undefined) {
      return false;
    }

    const key = this.getPromptKey(chat.id, user.id);
    const prompt = this.menuPrompts.get(key);

    if (
      prompt === undefined ||
      prompt.expiresAt <= Date.now() ||
      message.reply_to_message?.message_id !== prompt.messageId
    ) {
      return false;
    }

    this.menuPrompts.delete(key);
    const familyGroup = await this.familyGroupsService.findByTelegramChatId(
      BigInt(chat.id),
    );
    const parsedInput = memberAddInputSchema.safeParse(
      parseMemberAddArguments(message.text),
    );

    if (familyGroup === null || !parsedInput.success) {
      await context.reply(MEMBER_ADD_USAGE);
      return true;
    }

    await this.createDraft(
      context,
      chat.id,
      user.id,
      familyGroup.id,
      parsedInput.data,
    );
    return true;
  }

  private async createDraft(
    context: Context,
    chatId: number,
    userId: number,
    familyGroupId: string,
    input: Omit<CreateFamilyMemberInput, 'familyGroupId'>,
  ): Promise<void> {
    const draft = this.pendingAdditions.create({
      chatId,
      requestedByUserId: userId,
      input: {
        familyGroupId,
        ...input,
      },
    });
    const keyboard = new InlineKeyboard()
      .text('Підтвердити', `member-add:confirm:${draft.id}`)
      .text('Скасувати', `member-add:cancel:${draft.id}`);

    await context.reply(this.renderDraft(draft.input), {
      reply_markup: keyboard,
    });
  }

  async handleMemberAdditionCallback(context: Context): Promise<void> {
    const chat = this.getGroupChat(context);
    const user = context.from;
    const callbackData = context.callbackQuery?.data;
    const match = callbackData?.match(MEMBER_ADD_CALLBACK_PATTERN);

    if (
      chat === null ||
      user === undefined ||
      match === null ||
      match === undefined
    ) {
      await context.answerCallbackQuery({
        text: 'Не вдалося обробити підтвердження.',
        show_alert: true,
      });
      return;
    }

    const [, action, draftId] = match;
    const draft = this.pendingAdditions.get(draftId);

    if (draft === null) {
      await context.answerCallbackQuery({
        text: 'Чернетка вже недійсна. Створи її ще раз.',
        show_alert: true,
      });
      return;
    }

    if (draft.chatId !== chat.id || draft.requestedByUserId !== user.id) {
      await context.answerCallbackQuery({
        text: 'Підтвердити цю чернетку може лише її автор.',
        show_alert: true,
      });
      return;
    }

    if (action === 'cancel') {
      this.pendingAdditions.discard(draftId);
      await context.answerCallbackQuery({ text: 'Додавання скасовано.' });
      await context.editMessageText('Додавання члена родини скасовано.');
      await replyWithFamilyMenu(context, 'Меню знову доступне.');
      return;
    }

    const confirmedDraft = this.pendingAdditions.consume(draftId);

    if (confirmedDraft === null) {
      await context.answerCallbackQuery({
        text: 'Чернетка вже недійсна. Створи її ще раз.',
        show_alert: true,
      });
      return;
    }

    try {
      const member = await this.familyMembersService.create(
        confirmedWrite(confirmedDraft.input),
      );

      await context.answerCallbackQuery({ text: 'Члена родини додано.' });
      await context.editMessageText(
        `Додано: ${member.firstName} (${this.formatDate(member.birthDate)}).`,
      );
      await replyWithFamilyMenu(context, 'Меню знову доступне.');
    } catch (error: unknown) {
      const details = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to create a confirmed family member.', details);
      await context.answerCallbackQuery({
        text: 'Не вдалося додати члена родини. Спробуй ще раз.',
        show_alert: true,
      });
    }
  }

  private getGroupChat(
    context: Context,
  ): { readonly id: number; readonly title: string } | null {
    const chat = context.chat;

    if (
      chat === undefined ||
      (chat.type !== 'group' && chat.type !== 'supergroup')
    ) {
      return null;
    }

    return chat;
  }

  private getCommandArguments(context: Context): string {
    const text = context.message?.text;

    if (text === undefined) {
      return '';
    }

    const command = /^\/member_add(?:@\w+)?(?:\s+|$)/u.exec(text);
    return command === null ? '' : text.slice(command[0].length).trim();
  }

  private getPromptKey(chatId: number, userId: number): string {
    return `${chatId}:${userId}`;
  }

  private renderDraft(input: CreateFamilyMemberInput): string {
    const lastName = input.lastName === null ? '—' : input.lastName;

    return [
      'Чернетка нового члена родини:',
      `Імʼя: ${input.firstName}`,
      `Прізвище: ${lastName}`,
      `Дата народження: ${this.formatDate(input.birthDate)}`,
      '',
      'Підтвердь додавання.',
    ].join('\n');
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
