import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../calendar/application/calendar.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCalendarBroadcastService } from './telegram-calendar-broadcast.service';

describe('TelegramCalendarBroadcastService', () => {
  const configServiceMock = { getOrThrow: jest.fn() };
  const calendarServiceMock = { listToday: jest.fn() };
  const telegramBotServiceMock = { sendMessage: jest.fn() };
  const service = new TelegramCalendarBroadcastService(
    configServiceMock as unknown as ConfigService,
    calendarServiceMock as unknown as CalendarService,
    telegramBotServiceMock as unknown as TelegramBotService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.getOrThrow.mockReturnValue('-1001234567890');
  });

  it('publishes today events during the Kyiv 08:00 hour', async () => {
    const now = new Date('2026-08-16T05:00:00.000Z');
    calendarServiceMock.listToday.mockResolvedValue([
      {
        id: 'holiday',
        summary: 'Успіння Пресвятої Богородиці',
        startsOn: '2026-08-16',
        isAllDay: true,
        htmlLink: null,
      },
    ]);

    await expect(service.publishIfKyivMorning(now)).resolves.toBe(true);

    expect(telegramBotServiceMock.sendMessage).toHaveBeenCalledWith(
      '-1001234567890',
      '🕊 Успіння Пресвятої Богородиці',
    );
  });

  it('does not send events outside the Kyiv 08:00 hour', async () => {
    await expect(
      service.publishIfKyivMorning(new Date('2026-08-16T06:00:00.000Z')),
    ).resolves.toBe(false);

    expect(calendarServiceMock.listToday).not.toHaveBeenCalled();
    expect(telegramBotServiceMock.sendMessage).not.toHaveBeenCalled();
  });
});
