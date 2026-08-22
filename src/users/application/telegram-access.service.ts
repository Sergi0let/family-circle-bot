import { Injectable } from '@nestjs/common';
import { TelegramUser } from '@prisma/client';
import { AccessPolicyService } from './access-policy.service';
import { TelegramUsersService } from './telegram-users.service';

export type TelegramAccess =
  | { readonly kind: 'NOT_REGISTERED' }
  | { readonly kind: 'PENDING'; readonly user: TelegramUser }
  | { readonly kind: 'BLOCKED'; readonly user: TelegramUser }
  | { readonly kind: 'ACTIVE'; readonly user: TelegramUser };

@Injectable()
export class TelegramAccessService {
  constructor(
    private readonly accessPolicyService: AccessPolicyService,
    private readonly telegramUsersService: TelegramUsersService,
  ) {}

  async resolveAccess(telegramUserId: string): Promise<TelegramAccess> {
    const user =
      await this.telegramUsersService.findByTelegramUserId(telegramUserId);

    if (!user) {
      return { kind: 'NOT_REGISTERED' };
    }

    if (this.accessPolicyService.isBlockedUser(user)) {
      return { kind: 'BLOCKED', user };
    }

    if (!this.accessPolicyService.canUseMemberFeatures(user)) {
      return { kind: 'PENDING', user };
    }

    return { kind: 'ACTIVE', user };
  }
}
