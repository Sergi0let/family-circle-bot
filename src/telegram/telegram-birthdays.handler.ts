import { Injectable } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import {
  FamilyBirthdays,
  UpcomingBirthday,
  BirthdaysService,
} from '../families/application/birthdays.service';
import { BIRTHDAYS_MENU_ACTION, replyWithFamilyMenu } from './telegram-menu';

@Injectable()
export class TelegramBirthdaysHandler {
  constructor(private readonly birthdaysService: BirthdaysService) {}

  register(bot: Bot<Context>): void {
    bot.command('birthdays', (context) => this.handleBirthdays(context));
    bot.hears(BIRTHDAYS_MENU_ACTION, (context) =>
      this.handleBirthdays(context),
    );
  }

  async handleBirthdays(context: Context): Promise<void> {
    const chat = context.chat;

    if (
      chat === undefined ||
      (chat.type !== 'group' && chat.type !== 'supergroup')
    ) {
      await replyWithFamilyMenu(
        context,
        'Ця команда доступна лише у сімейній групі.',
      );
      return;
    }

    const result = await this.birthdaysService.listForTelegramChatId(
      BigInt(chat.id),
    );

    if (result === null) {
      await replyWithFamilyMenu(
        context,
        'Спочатку активуй групу командою /start.',
      );
      return;
    }

    if (result.birthdays.length === 0) {
      await replyWithFamilyMenu(
        context,
        'У цій групі ще немає доданих днів народження.',
      );
      return;
    }

    await replyWithFamilyMenu(context, this.renderBirthdays(result));
  }

  private renderBirthdays(result: FamilyBirthdays): string {
    return [
      'Усі дні народження за найближчою датою:',
      ...result.birthdays.map((birthday) => this.renderBirthday(birthday)),
    ].join('\n');
  }

  private renderBirthday(birthday: UpcomingBirthday): string {
    const name = [birthday.member.firstName, birthday.member.lastName]
      .filter((part): part is string => part !== null)
      .join(' ');
    const date = new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(
      new Date(
        Date.UTC(2000, birthday.occurrence.month - 1, birthday.occurrence.day),
      ),
    );

    return `• ${name} — ${date} (${this.formatDaysUntil(birthday.daysUntil)})`;
  }

  private formatDaysUntil(daysUntil: number): string {
    if (daysUntil === 0) {
      return 'сьогодні';
    }

    if (daysUntil === 1) {
      return 'завтра';
    }

    return `через ${daysUntil} дн.`;
  }
}
