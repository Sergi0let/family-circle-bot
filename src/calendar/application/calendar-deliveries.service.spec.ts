import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarDeliveriesService } from './calendar-deliveries.service';

describe('CalendarDeliveriesService', () => {
  const prismaMock = {
    calendarEventDelivery: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new CalendarDeliveriesService(
    prismaMock as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims a delivery atomically before it is sent', async () => {
    prismaMock.calendarEventDelivery.create.mockResolvedValue({});

    await expect(
      service.claimDelivery('family-group-id', 'event-id', '2026-08-16'),
    ).resolves.toBe(true);

    expect(prismaMock.calendarEventDelivery.create).toHaveBeenCalledWith({
      data: {
        familyGroupId: 'family-group-id',
        calendarEventId: 'event-id',
        occurrenceDate: new Date('2026-08-16T00:00:00.000Z'),
      },
    });
  });

  it('does not claim a delivery already reserved by another process', async () => {
    prismaMock.calendarEventDelivery.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.claimDelivery('family-group-id', 'event-id', '2026-08-16'),
    ).resolves.toBe(false);
  });

  it('rejects an invalid calendar occurrence date', async () => {
    await expect(
      service.claimDelivery('family-group-id', 'event-id', '2026-02-31'),
    ).rejects.toThrow('Calendar event has an invalid occurrence date.');
  });
});
