import { Injectable } from '@nestjs/common';
import { TelegramUser, TelegramUserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface TelegramUserProfile {
  readonly telegramUserId: string;
  readonly privateChatId?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly username?: string;
}

@Injectable()
export class TelegramUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async registerPrivateUser(
    profile: TelegramUserProfile,
  ): Promise<TelegramUser> {
    return this.prisma.telegramUser.upsert({
      where: { telegramUserId: profile.telegramUserId },
      create: {
        telegramUserId: profile.telegramUserId,
        privateChatId: profile.privateChatId ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        username: profile.username ?? null,
      },
      update: this.toProfileUpdate(profile),
    });
  }

  async createOrActivate(profile: TelegramUserProfile): Promise<TelegramUser> {
    return this.prisma.telegramUser.upsert({
      where: { telegramUserId: profile.telegramUserId },
      create: {
        telegramUserId: profile.telegramUserId,
        privateChatId: profile.privateChatId ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        username: profile.username ?? null,
        status: TelegramUserStatus.ACTIVE,
      },
      update: {
        ...this.toProfileUpdate(profile),
        status: TelegramUserStatus.ACTIVE,
      },
    });
  }

  private toProfileUpdate(profile: TelegramUserProfile) {
    return {
      ...(profile.privateChatId === undefined
        ? {}
        : { privateChatId: profile.privateChatId }),
      ...(profile.firstName === undefined
        ? {}
        : { firstName: profile.firstName }),
      ...(profile.lastName === undefined ? {} : { lastName: profile.lastName }),
      ...(profile.username === undefined ? {} : { username: profile.username }),
    };
  }
}
