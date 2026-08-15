import { Injectable } from '@nestjs/common';
import { FamilyGroup, FamilyMember } from '../../generated/prisma/client';
import { FamilyGroupsService } from './family-groups.service';
import { FamilyMembersService } from './family-members.service';

const DEFAULT_TIME_ZONE = 'Europe/Kyiv';

interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface UpcomingBirthday {
  readonly member: FamilyMember;
  readonly occurrence: CalendarDate;
  readonly daysUntil: number;
}

export interface FamilyBirthdays {
  readonly familyGroup: FamilyGroup;
  readonly birthdays: UpcomingBirthday[];
}

@Injectable()
export class BirthdaysService {
  constructor(
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly familyMembersService: FamilyMembersService,
  ) {}

  async listForTelegramChatId(
    telegramChatId: bigint,
    now: Date = new Date(),
  ): Promise<FamilyBirthdays | null> {
    const familyGroup =
      await this.familyGroupsService.findByTelegramChatId(telegramChatId);

    if (familyGroup === null) {
      return null;
    }

    const today = this.getCalendarDate(now);
    const members = await this.familyMembersService.listByFamilyGroupId(
      familyGroup.id,
    );
    const birthdays = members
      .map((member) => this.toUpcomingBirthday(member, today))
      .sort(
        (left, right) =>
          left.daysUntil - right.daysUntil ||
          left.member.firstName.localeCompare(right.member.firstName, 'uk'),
      );

    return { familyGroup, birthdays };
  }

  private toUpcomingBirthday(
    member: FamilyMember,
    today: CalendarDate,
  ): UpcomingBirthday {
    const birthMonth = member.birthDate.getUTCMonth() + 1;
    const birthDay = member.birthDate.getUTCDate();
    let occurrence = this.getBirthdayOccurrence(
      today.year,
      birthMonth,
      birthDay,
    );

    if (this.compareCalendarDates(occurrence, today) < 0) {
      occurrence = this.getBirthdayOccurrence(
        today.year + 1,
        birthMonth,
        birthDay,
      );
    }

    return {
      member,
      occurrence,
      daysUntil: this.getDaysBetween(today, occurrence),
    };
  }

  private getCalendarDate(value: Date): CalendarDate {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(value);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
    };
  }

  private getBirthdayOccurrence(
    year: number,
    month: number,
    day: number,
  ): CalendarDate {
    if (month === 2 && day === 29 && !this.isLeapYear(year)) {
      return { year, month: 2, day: 28 };
    }

    return { year, month, day };
  }

  private isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  private compareCalendarDates(
    left: CalendarDate,
    right: CalendarDate,
  ): number {
    return (
      Date.UTC(left.year, left.month - 1, left.day) -
      Date.UTC(right.year, right.month - 1, right.day)
    );
  }

  private getDaysBetween(from: CalendarDate, to: CalendarDate): number {
    return this.compareCalendarDates(to, from) / (24 * 60 * 60 * 1000);
  }
}
