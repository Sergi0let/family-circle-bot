import { Injectable, Logger } from '@nestjs/common';
import { TelegramUserRole, TelegramUserStatus } from '@prisma/client';
import { Api, InlineKeyboard } from 'grammy';
import { AccessRequestWithApplicant } from '../access-requests/application/access-requests.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TelegramAccessRequestNotifierService {
  private readonly logger = new Logger(
    TelegramAccessRequestNotifierService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async notifyModerators(
    request: AccessRequestWithApplicant,
    api: Api,
  ): Promise<void> {
    const recipients = await this.prisma.telegramUser.findMany({
      where: {
        status: TelegramUserStatus.ACTIVE,
        role: {
          in: [TelegramUserRole.MODERATOR, TelegramUserRole.ADMIN],
        },
        privateChatId: { not: null },
      },
      select: { privateChatId: true },
    });

    const keyboard = new InlineKeyboard()
      .text('✅ Прийняти', `access-request:${request.id}:approve`)
      .text('❌ Відхилити', `access-request:${request.id}:reject`);
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        api.sendMessage(
          recipient.privateChatId as string,
          this.toModeratorMessage(request),
          { reply_markup: keyboard },
        ),
      ),
    );

    const failures = results.filter((result) => result.status === 'rejected');

    if (failures.length > 0) {
      this.logger.error(
        `Could not notify ${failures.length} moderator(s) about access request ${request.id}.`,
      );
    }

    if (recipients.length === 0) {
      this.logger.warn(
        `No active moderator with a private chat is available for access request ${request.id}.`,
      );
    }
  }

  private toModeratorMessage(request: AccessRequestWithApplicant): string {
    const applicant = request.applicant;
    const name = [applicant.firstName, applicant.lastName]
      .filter((part): part is string => part !== null && part.length > 0)
      .join(' ');
    const username =
      applicant.username === null ? '—' : `@${applicant.username}`;

    return [
      'Новий запит на доступ',
      '',
      `Ім’я: ${name || '—'}`,
      `Username: ${username}`,
      `Telegram ID: ${applicant.telegramUserId}`,
    ].join('\n');
  }
}
