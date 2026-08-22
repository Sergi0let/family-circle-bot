import { Injectable } from '@nestjs/common';
import {
  TelegramUser,
  TelegramUserRole,
  TelegramUserStatus,
} from '@prisma/client';

@Injectable()
export class AccessPolicyService {
  canUseMemberFeatures(user: TelegramUser): boolean {
    return user.status === TelegramUserStatus.ACTIVE;
  }

  canModerate(user: TelegramUser): boolean {
    return (
      user.status === TelegramUserStatus.ACTIVE &&
      (user.role === TelegramUserRole.MODERATOR ||
        user.role === TelegramUserRole.ADMIN)
    );
  }

  canAdminister(user: TelegramUser): boolean {
    return (
      user.status === TelegramUserStatus.ACTIVE &&
      user.role === TelegramUserRole.ADMIN
    );
  }

  isBlockedUser(user: TelegramUser): boolean {
    return user.status === TelegramUserStatus.BLOCKED;
  }

  isRejectedUser(user: TelegramUser): boolean {
    return user.status === TelegramUserStatus.REJECTED;
  }
}
