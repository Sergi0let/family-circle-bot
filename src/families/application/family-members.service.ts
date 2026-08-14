import { Injectable } from '@nestjs/common';
import { FamilyMember } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmedWrite, getConfirmedInput } from './confirmed-write';
import {
  assertValidDate,
  InvalidFamilyInputError,
  normalizeOptionalText,
  normalizeRequiredText,
} from './family-input';

export interface CreateFamilyMemberInput {
  readonly familyGroupId: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly birthDate: Date;
}

export interface UpdateFamilyMemberInput {
  readonly familyGroupId: string;
  readonly memberId: string;
  readonly firstName?: string;
  readonly lastName?: string | null;
  readonly birthDate?: Date;
}

export interface DeleteFamilyMemberInput {
  readonly familyGroupId: string;
  readonly memberId: string;
}

export class FamilyGroupNotFoundError extends Error {
  constructor() {
    super('Family group was not found.');
  }
}

export class FamilyMemberNotFoundError extends Error {
  constructor() {
    super('Family member was not found.');
  }
}

@Injectable()
export class FamilyMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    command: ConfirmedWrite<CreateFamilyMemberInput>,
  ): Promise<FamilyMember> {
    const input = getConfirmedInput(command);
    await this.assertFamilyGroupExists(input.familyGroupId);

    return this.prisma.familyMember.create({
      data: {
        familyGroupId: input.familyGroupId,
        firstName: normalizeRequiredText(input.firstName, 'first name'),
        lastName: normalizeOptionalText(input.lastName),
        birthDate: assertValidDate(input.birthDate, 'birth date'),
      },
    });
  }

  async listByFamilyGroupId(familyGroupId: string): Promise<FamilyMember[]> {
    return this.prisma.familyMember.findMany({
      where: { familyGroupId },
      orderBy: [{ birthDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async update(
    command: ConfirmedWrite<UpdateFamilyMemberInput>,
  ): Promise<FamilyMember> {
    const input = getConfirmedInput(command);
    const member = await this.prisma.familyMember.findFirst({
      where: {
        id: input.memberId,
        familyGroupId: input.familyGroupId,
      },
    });

    if (member === null) {
      throw new FamilyMemberNotFoundError();
    }

    const data = this.getUpdateData(input);
    return this.prisma.familyMember.update({
      where: { id: member.id },
      data,
    });
  }

  async delete(
    command: ConfirmedWrite<DeleteFamilyMemberInput>,
  ): Promise<void> {
    const input = getConfirmedInput(command);
    const result = await this.prisma.familyMember.deleteMany({
      where: {
        id: input.memberId,
        familyGroupId: input.familyGroupId,
      },
    });

    if (result.count === 0) {
      throw new FamilyMemberNotFoundError();
    }
  }

  private async assertFamilyGroupExists(familyGroupId: string): Promise<void> {
    const group = await this.prisma.familyGroup.findUnique({
      where: { id: familyGroupId },
      select: { id: true },
    });

    if (group === null) {
      throw new FamilyGroupNotFoundError();
    }
  }

  private getUpdateData(input: UpdateFamilyMemberInput) {
    const data: {
      firstName?: string;
      lastName?: string | null;
      birthDate?: Date;
    } = {};

    if (input.firstName !== undefined) {
      data.firstName = normalizeRequiredText(input.firstName, 'first name');
    }

    if (input.lastName !== undefined) {
      data.lastName = normalizeOptionalText(input.lastName);
    }

    if (input.birthDate !== undefined) {
      data.birthDate = assertValidDate(input.birthDate, 'birth date');
    }

    if (Object.keys(data).length === 0) {
      throw new InvalidFamilyInputError('family member update');
    }

    return data;
  }
}
