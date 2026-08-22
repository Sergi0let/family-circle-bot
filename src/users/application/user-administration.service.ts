import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TelegramUser,
  TelegramUserRole,
  TelegramUserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface TelegramUsersPage {
  readonly users: TelegramUser[];
  readonly total: number;
}

@Injectable()
export class UserAdministrationService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(
    administratorTelegramUserId: string,
    skip: number,
    take: number,
  ): Promise<TelegramUsersPage> {
    await this.requireAdministrator(administratorTelegramUserId);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.telegramUser.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.telegramUser.count(),
    ]);

    return { users, total };
  }

  async getUser(
    administratorTelegramUserId: string,
    telegramUserId: string,
  ): Promise<TelegramUser> {
    await this.requireAdministrator(administratorTelegramUserId);

    return this.getUserOrThrow(telegramUserId);
  }

  async changeStatus(
    administratorTelegramUserId: string,
    telegramUserId: string,
    status: TelegramUserStatus,
  ): Promise<TelegramUser> {
    return this.prisma.$transaction(
      async (transaction) => {
        const administrator = await this.requireAdministrator(
          administratorTelegramUserId,
          transaction,
        );
        const user = await this.getUserOrThrow(telegramUserId, transaction);

        this.assertNotSelf(administrator.telegramUserId, user.telegramUserId);
        await this.assertActiveAdminWillRemain(user, { status }, transaction);

        return transaction.telegramUser.update({
          where: { id: user.id },
          data: { status },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async changeRole(
    administratorTelegramUserId: string,
    telegramUserId: string,
    role: TelegramUserRole,
  ): Promise<TelegramUser> {
    return this.prisma.$transaction(
      async (transaction) => {
        const administrator = await this.requireAdministrator(
          administratorTelegramUserId,
          transaction,
        );
        const user = await this.getUserOrThrow(telegramUserId, transaction);

        this.assertNotSelf(administrator.telegramUserId, user.telegramUserId);
        await this.assertActiveAdminWillRemain(user, { role }, transaction);

        return transaction.telegramUser.update({
          where: { id: user.id },
          data: { role },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async deleteUser(
    administratorTelegramUserId: string,
    telegramUserId: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const administrator = await this.requireAdministrator(
          administratorTelegramUserId,
          transaction,
        );
        const user = await this.getUserOrThrow(telegramUserId, transaction);

        this.assertNotSelf(administrator.telegramUserId, user.telegramUserId);
        await this.assertActiveAdminWillRemain(
          user,
          { status: TelegramUserStatus.BLOCKED },
          transaction,
        );

        await transaction.telegramUser.delete({ where: { id: user.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async requireAdministrator(
    telegramUserId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<TelegramUser> {
    const administrator = await prisma.telegramUser.findFirst({
      where: {
        telegramUserId,
        status: TelegramUserStatus.ACTIVE,
        role: TelegramUserRole.ADMIN,
      },
    });

    if (administrator === null) {
      throw new ForbiddenException('Administrator access is required.');
    }

    return administrator;
  }

  private async getUserOrThrow(
    telegramUserId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<TelegramUser> {
    const user = await prisma.telegramUser.findUnique({
      where: { telegramUserId },
    });

    if (user === null) {
      throw new NotFoundException('Telegram user not found.');
    }

    return user;
  }

  private assertNotSelf(
    administratorTelegramUserId: string,
    targetTelegramUserId: string,
  ): void {
    if (administratorTelegramUserId === targetTelegramUserId) {
      throw new ForbiddenException(
        'Administrators cannot change their own status or role.',
      );
    }
  }

  private async assertActiveAdminWillRemain(
    user: TelegramUser,
    update: Pick<TelegramUser, 'status'> | Pick<TelegramUser, 'role'>,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    const nextStatus = 'status' in update ? update.status : user.status;
    const nextRole = 'role' in update ? update.role : user.role;
    const removesActiveAdmin =
      user.status === TelegramUserStatus.ACTIVE &&
      user.role === TelegramUserRole.ADMIN &&
      (nextStatus !== TelegramUserStatus.ACTIVE ||
        nextRole !== TelegramUserRole.ADMIN);

    if (!removesActiveAdmin) {
      return;
    }

    const activeAdmins = await transaction.telegramUser.count({
      where: {
        status: TelegramUserStatus.ACTIVE,
        role: TelegramUserRole.ADMIN,
      },
    });

    if (activeAdmins <= 1) {
      throw new ForbiddenException(
        'At least one active administrator must remain.',
      );
    }
  }
}
