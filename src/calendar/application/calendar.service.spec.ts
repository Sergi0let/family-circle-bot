import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  const configServiceMock = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };
  const googleCalendarServiceMock = {
    assertReadable: jest.fn(),
    listEventsForToday: jest.fn(),
  };
  const service = new CalendarService(
    configServiceMock as unknown as ConfigService,
    googleCalendarServiceMock as unknown as GoogleCalendarService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.getOrThrow.mockReturnValue('family@example.com');
    configServiceMock.get.mockReturnValue(undefined);
  });

  it('reads today events from the configured calendar', async () => {
    const now = new Date('2026-08-16T05:00:00.000Z');
    const events = [
      {
        id: 'holiday',
        source: 'family',
        summary: 'Свято',
        startsOn: '2026-08-16',
        isAllDay: true,
        htmlLink: null,
      },
    ];
    googleCalendarServiceMock.listEventsForToday.mockResolvedValue(events);

    await expect(service.listToday(now)).resolves.toEqual(events);
    expect(googleCalendarServiceMock.listEventsForToday).toHaveBeenCalledWith(
      'family@example.com',
      now,
      'family',
    );
  });

  it('also reads a configured public-holidays calendar', async () => {
    const now = new Date('2026-08-16T05:00:00.000Z');
    configServiceMock.get.mockReturnValue(
      'ukrainian__ukraine@holiday.calendar.google.com',
    );
    googleCalendarServiceMock.listEventsForToday.mockResolvedValueOnce([]);
    googleCalendarServiceMock.listEventsForToday.mockResolvedValueOnce([
      {
        id: 'public-holiday',
        source: 'public-holidays',
        summary: 'День Незалежності України',
      },
    ]);

    await expect(service.listToday(now)).resolves.toEqual([
      {
        id: 'public-holiday',
        source: 'public-holidays',
        summary: 'День Незалежності України',
      },
    ]);
    expect(
      googleCalendarServiceMock.listEventsForToday,
    ).toHaveBeenNthCalledWith(1, 'family@example.com', now, 'family');
    expect(
      googleCalendarServiceMock.listEventsForToday,
    ).toHaveBeenNthCalledWith(
      2,
      'ukrainian__ukraine@holiday.calendar.google.com',
      now,
      'public-holidays',
    );
  });

  it('checks access to the configured calendar', async () => {
    await service.assertReadable();

    expect(googleCalendarServiceMock.assertReadable).toHaveBeenCalledWith(
      'family@example.com',
    );
  });

  it('checks the public-holidays calendar when it is configured', async () => {
    configServiceMock.get.mockReturnValue(
      'ukrainian__ukraine@holiday.calendar.google.com',
    );

    await service.assertReadable();

    expect(googleCalendarServiceMock.assertReadable).toHaveBeenNthCalledWith(
      1,
      'family@example.com',
    );
    expect(googleCalendarServiceMock.assertReadable).toHaveBeenNthCalledWith(
      2,
      'ukrainian__ukraine@holiday.calendar.google.com',
    );
  });
});
