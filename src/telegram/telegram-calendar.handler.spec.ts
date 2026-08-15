import { ConfigService } from '@nestjs/config';
import { Context } from 'grammy';
import { CalendarService } from '../calendar/application/calendar.service';
import { TelegramCalendarHandler } from './telegram-calendar.handler';

describe('TelegramCalendarHandler', () => {
  const configServiceMock = { getOrThrow: jest.fn() };
  const calendarServiceMock = { listToday: jest.fn() };
  const handler = new TelegramCalendarHandler(
    configServiceMock as unknown as ConfigService,
    calendarServiceMock as unknown as CalendarService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.getOrThrow.mockReturnValue('-1001234567890');
  });

  it('shows today events only in the configured Telegram group', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    calendarServiceMock.listToday.mockResolvedValue([
      {
        id: 'holiday',
        summary: 'Свято',
        startsOn: '2026-08-16',
        isAllDay: true,
        htmlLink: null,
      },
    ]);
    const context = {
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Family Circle',
      },
      reply,
    };

    await handler.handleCalendarToday(context as unknown as Context);

    expect(reply).toHaveBeenCalledWith('🕊 Свято');
  });

  it('does not expose calendar data to another group', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: { id: -1009876543210, type: 'supergroup', title: 'Other group' },
      reply,
    };

    await handler.handleCalendarToday(context as unknown as Context);

    expect(calendarServiceMock.listToday).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      'Ця команда доступна лише у налаштованій сімейній групі.',
    );
  });
});
