import { Injectable } from '@nestjs/common';
import { FamilyGroup } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmedWrite, getConfirmedInput } from './confirmed-write';
import { normalizeRequiredText } from './family-input';

export interface RegisterFamilyGroupInput {
  readonly telegramChatId: bigint;
  readonly title: string;
}

@Injectable()
export class FamilyGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    command: ConfirmedWrite<RegisterFamilyGroupInput>,
  ): Promise<FamilyGroup> {
    const input = getConfirmedInput(command);
    const title = normalizeRequiredText(input.title, 'family group title');

    return this.prisma.familyGroup.upsert({
      where: { telegramChatId: input.telegramChatId },
      create: {
        telegramChatId: input.telegramChatId,
        title,
      },
      update: { title },
    });
  }

  async findByTelegramChatId(
    telegramChatId: bigint,
  ): Promise<FamilyGroup | null> {
    return this.prisma.familyGroup.findUnique({
      where: { telegramChatId },
    });
  }
}
