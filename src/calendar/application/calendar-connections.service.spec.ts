import { FamilyGroupsService } from '../../families/application/family-groups.service';
import { PrismaService } from '../../prisma/prisma.service';
import { confirmedWrite } from '../../families/application/confirmed-write';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import { CalendarConnectionsService } from './calendar-connections.service';

describe('CalendarConnectionsService', () => {
  const familyGroup = {
    id: 'family-group-id',
    telegramChatId: -1001234567890n,
    title: 'Family Circle',
    googleCalendarId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prismaMock = {
    familyGroup: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const familyGroupsServiceMock = {
    findByTelegramChatId: jest.fn(),
  };
  const googleCalendarServiceMock = {
    assertReadable: jest.fn(),
  };
  const service = new CalendarConnectionsService(
    prismaMock as unknown as PrismaService,
    familyGroupsServiceMock as unknown as FamilyGroupsService,
    googleCalendarServiceMock as unknown as GoogleCalendarService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks Google Calendar access before saving the connection', async () => {
    prismaMock.familyGroup.findUnique.mockResolvedValue(familyGroup);
    prismaMock.familyGroup.update.mockResolvedValue({
      ...familyGroup,
      googleCalendarId: 'family@example.com',
    });

    await service.connectGoogleCalendar(
      confirmedWrite({
        familyGroupId: familyGroup.id,
        googleCalendarId: ' family@example.com ',
      }),
    );

    expect(googleCalendarServiceMock.assertReadable).toHaveBeenCalledWith(
      'family@example.com',
    );
    expect(prismaMock.familyGroup.update).toHaveBeenCalledWith({
      where: { id: familyGroup.id },
      data: { googleCalendarId: 'family@example.com' },
    });
  });

  it('does not save a connection when Google rejects calendar access', async () => {
    prismaMock.familyGroup.findUnique.mockResolvedValue(familyGroup);
    googleCalendarServiceMock.assertReadable.mockRejectedValue(
      new Error('Forbidden'),
    );

    await expect(
      service.connectGoogleCalendar(
        confirmedWrite({
          familyGroupId: familyGroup.id,
          googleCalendarId: 'family@example.com',
        }),
      ),
    ).rejects.toThrow('Forbidden');

    expect(prismaMock.familyGroup.update).not.toHaveBeenCalled();
  });
});
