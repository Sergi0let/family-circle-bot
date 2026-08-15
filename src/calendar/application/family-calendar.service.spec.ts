import { FamilyGroupsService } from '../../families/application/family-groups.service';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import { FamilyCalendarService } from './family-calendar.service';

describe('FamilyCalendarService', () => {
  const familyGroupsServiceMock = {
    findByTelegramChatId: jest.fn(),
  };
  const googleCalendarServiceMock = {
    listEventsForToday: jest.fn(),
  };
  const service = new FamilyCalendarService(
    familyGroupsServiceMock as unknown as FamilyGroupsService,
    googleCalendarServiceMock as unknown as GoogleCalendarService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not query Google Calendar until a group has connected one', async () => {
    familyGroupsServiceMock.findByTelegramChatId.mockResolvedValue({
      id: 'family-group-id',
      googleCalendarId: null,
    });

    await expect(
      service.listTodayForTelegramChatId(-1001234567890n),
    ).resolves.toEqual({
      events: [],
      isConnected: false,
      isKnownGroup: true,
    });

    expect(googleCalendarServiceMock.listEventsForToday).not.toHaveBeenCalled();
  });

  it('returns today events from the connected calendar', async () => {
    familyGroupsServiceMock.findByTelegramChatId.mockResolvedValue({
      id: 'family-group-id',
      googleCalendarId: 'family@example.com',
    });
    const now = new Date('2026-08-15T12:00:00.000Z');
    const events = [
      {
        id: 'event-id',
        summary: 'Успіння Пресвятої Богородиці',
        startsOn: '2026-08-15',
        isAllDay: true,
        htmlLink: null,
      },
    ];
    googleCalendarServiceMock.listEventsForToday.mockResolvedValue(events);

    await expect(
      service.listTodayForTelegramChatId(-1001234567890n, now),
    ).resolves.toEqual({ events, isConnected: true, isKnownGroup: true });

    expect(googleCalendarServiceMock.listEventsForToday).toHaveBeenCalledWith(
      'family@example.com',
      now,
    );
  });
});
