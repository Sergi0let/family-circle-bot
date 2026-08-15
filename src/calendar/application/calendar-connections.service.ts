import { Injectable } from '@nestjs/common';
import { FamilyGroup } from '../../generated/prisma/client';
import { FamilyGroupsService } from '../../families/application/family-groups.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConfirmedWrite,
  getConfirmedInput,
} from '../../families/application/confirmed-write';
import { normalizeRequiredText } from '../../families/application/family-input';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';

export interface ConnectGoogleCalendarInput {
  readonly familyGroupId: string;
  readonly googleCalendarId: string;
}

export class GoogleCalendarNotConnectedError extends Error {
  constructor() {
    super('Google Calendar is not connected.');
  }
}

@Injectable()
export class CalendarConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async connectGoogleCalendar(
    command: ConfirmedWrite<ConnectGoogleCalendarInput>,
  ): Promise<FamilyGroup> {
    const input = getConfirmedInput(command);
    const googleCalendarId = normalizeRequiredText(
      input.googleCalendarId,
      'Google Calendar ID',
    );
    const familyGroup = await this.assertFamilyGroupExists(input.familyGroupId);

    await this.googleCalendarService.assertReadable(googleCalendarId);

    return this.prisma.familyGroup.update({
      where: { id: familyGroup.id },
      data: { googleCalendarId },
    });
  }

  async getGoogleCalendarIdForTelegramChatId(
    telegramChatId: bigint,
  ): Promise<string | null> {
    const familyGroup =
      await this.familyGroupsService.findByTelegramChatId(telegramChatId);

    return familyGroup?.googleCalendarId ?? null;
  }

  private async assertFamilyGroupExists(
    familyGroupId: string,
  ): Promise<FamilyGroup> {
    const familyGroup = await this.prisma.familyGroup.findUnique({
      where: { id: familyGroupId },
    });

    if (familyGroup === null) {
      throw new Error('Family group was not found.');
    }

    return familyGroup;
  }
}
