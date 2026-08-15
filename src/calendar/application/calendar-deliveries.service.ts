import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CalendarDeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  async claimDelivery(
    familyGroupId: string,
    calendarEventId: string,
    occurrenceDate: string,
  ): Promise<boolean> {
    const identity = {
      familyGroupId,
      calendarEventId,
      occurrenceDate: this.toOccurrenceDate(occurrenceDate),
    };

    try {
      await this.prisma.calendarEventDelivery.create({ data: identity });
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }

      throw error;
    }
  }

  async releaseClaim(
    familyGroupId: string,
    calendarEventId: string,
    occurrenceDate: string,
  ): Promise<void> {
    await this.prisma.calendarEventDelivery.delete({
      where: {
        familyGroupId_calendarEventId_occurrenceDate: {
          familyGroupId,
          calendarEventId,
          occurrenceDate: this.toOccurrenceDate(occurrenceDate),
        },
      },
    });
  }

  private toOccurrenceDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
      throw new Error('Calendar event has an invalid occurrence date.');
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new Error('Calendar event has an invalid occurrence date.');
    }

    return date;
  }
}
