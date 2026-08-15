import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from '../infrastructure/google-calendar.service';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  const configServiceMock = {
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
  });

  it('reads today events from the configured calendar', async () => {
    const now = new Date('2026-08-16T05:00:00.000Z');
    const events = [
      {
        id: 'holiday',
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
    );
  });

  it('checks access to the configured calendar', async () => {
    await service.assertReadable();

    expect(googleCalendarServiceMock.assertReadable).toHaveBeenCalledWith(
      'family@example.com',
    );
  });
});
