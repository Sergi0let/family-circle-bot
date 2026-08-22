import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessRequestStatus,
  Prisma,
  TelegramUserRole,
  TelegramUserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TelegramAccessService } from '../../users/application/telegram-access.service';
import { TelegramUserProfile } from '../../users/application/telegram-users.service';

export type AccessRequestWithApplicant = Prisma.AccessRequestGetPayload<{
  include: { applicant: true };
}>;

export interface SubmittedAccessRequest {
  readonly request: AccessRequestWithApplicant;
  readonly isNew: boolean;
}

@Injectable()
export class AccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramAccessService: TelegramAccessService,
  ) {}

  async submit(profile: TelegramUserProfile): Promise<SubmittedAccessRequest> {
    return this.prisma.$transaction(async (transaction) => {
      const applicant = await transaction.telegramUser.upsert({
        where: { telegramUserId: profile.telegramUserId },
        create: {
          telegramUserId: profile.telegramUserId,
          privateChatId: profile.privateChatId ?? null,
          firstName: profile.firstName ?? null,
          lastName: profile.lastName ?? null,
          username: profile.username ?? null,
          status: TelegramUserStatus.PENDING,
          role: TelegramUserRole.MEMBER,
        },
        update: {
          ...(profile.privateChatId === undefined
            ? {}
            : { privateChatId: profile.privateChatId }),
          ...(profile.firstName === undefined
            ? {}
            : { firstName: profile.firstName }),
          ...(profile.lastName === undefined
            ? {}
            : { lastName: profile.lastName }),
          ...(profile.username === undefined
            ? {}
            : { username: profile.username }),
        },
      });

      if (applicant.status !== TelegramUserStatus.PENDING) {
        throw new ConflictException(
          'This Telegram account cannot submit a request.',
        );
      }

      const existingRequest = await transaction.accessRequest.findUnique({
        where: { applicantUserId: applicant.id },
        include: { applicant: true },
      });

      if (existingRequest !== null) {
        if (existingRequest.status === AccessRequestStatus.PENDING) {
          return { request: existingRequest, isNew: false };
        }

        throw new ConflictException(
          'This access request has already been handled.',
        );
      }

      const request = await transaction.accessRequest.create({
        data: { applicantUserId: applicant.id },
        include: { applicant: true },
      });

      return { request, isNew: true };
    });
  }

  async getPendingForModerator(
    requestId: string,
    moderatorTelegramUserId: string,
  ): Promise<AccessRequestWithApplicant> {
    await this.requireModerator(moderatorTelegramUserId);

    const request = await this.prisma.accessRequest.findUnique({
      where: { id: requestId },
      include: { applicant: true },
    });

    if (request === null || request.status !== AccessRequestStatus.PENDING) {
      throw new NotFoundException('The access request is no longer pending.');
    }

    return request;
  }

  async approve(
    requestId: string,
    moderatorTelegramUserId: string,
  ): Promise<AccessRequestWithApplicant> {
    return this.decide(
      requestId,
      moderatorTelegramUserId,
      AccessRequestStatus.APPROVED,
      TelegramUserStatus.ACTIVE,
    );
  }

  async reject(
    requestId: string,
    moderatorTelegramUserId: string,
  ): Promise<AccessRequestWithApplicant> {
    return this.decide(
      requestId,
      moderatorTelegramUserId,
      AccessRequestStatus.REJECTED,
      TelegramUserStatus.REJECTED,
    );
  }

  private async decide(
    requestId: string,
    moderatorTelegramUserId: string,
    requestStatus: AccessRequestStatus,
    userStatus: TelegramUserStatus,
  ): Promise<AccessRequestWithApplicant> {
    const moderator = await this.requireModerator(moderatorTelegramUserId);

    return this.prisma.$transaction(async (transaction) => {
      const request = await transaction.accessRequest.findUnique({
        where: { id: requestId },
      });

      if (request === null) {
        throw new NotFoundException('Access request not found.');
      }

      const decidedAt = new Date();
      const updatedRequest = await transaction.accessRequest.updateMany({
        where: { id: request.id, status: AccessRequestStatus.PENDING },
        data: {
          status: requestStatus,
          decidedByUserId: moderator.id,
          decidedAt,
        },
      });

      if (updatedRequest.count !== 1) {
        throw new ConflictException(
          'The access request has already been handled.',
        );
      }

      const updatedApplicant = await transaction.telegramUser.updateMany({
        where: {
          id: request.applicantUserId,
          status: TelegramUserStatus.PENDING,
        },
        data: { status: userStatus },
      });

      if (updatedApplicant.count !== 1) {
        throw new ConflictException('The applicant access state has changed.');
      }

      return transaction.accessRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: { applicant: true },
      });
    });
  }

  private async requireModerator(moderatorTelegramUserId: string) {
    const moderator = await this.telegramAccessService.findActiveModerator(
      moderatorTelegramUserId,
    );

    if (moderator === null) {
      throw new ForbiddenException('Moderator access is required.');
    }

    return moderator;
  }
}
