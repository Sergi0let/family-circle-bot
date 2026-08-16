import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../calendar/application/calendar.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCalendarBroadcastService } from './telegram-calendar-broadcast.service';

describe('TelegramCalendarBroadcastService', () => {
  const configServiceMock = { getOrThrow: jest.fn() };
  const calendarServiceMock = { listToday: jest.fn() };
  const greetingGeneratorMock = { generate: jest.fn() };
  const telegramBotServiceMock = { sendMessage: jest.fn() };
  const service = new TelegramCalendarBroadcastService(
    configServiceMock as unknown as ConfigService,
    calendarServiceMock as unknown as CalendarService,
    greetingGeneratorMock,
    telegramBotServiceMock as unknown as TelegramBotService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.getOrThrow.mockReturnValue('-1001234567890');
    greetingGeneratorMock.generate.mockResolvedValue({
      text: 'Зі святом!',
    });
  });

  it('publishes today events during the Kyiv 09:00 hour in summer', async () => {
    const now = new Date('2026-08-16T06:30:00.000Z');
    calendarServiceMock.listToday.mockResolvedValue([
      {
        description: null,
        id: 'holiday',
        iCalUID: 'pcu-20260816@family-circle-bot',
        source: 'family',
        summary: 'Успіння Пресвятої Богородиці',
        startsOn: '2026-08-16',
        isAllDay: true,
        htmlLink: null,
      },
    ]);

    await expect(service.publishIfKyivScheduledTime(now)).resolves.toBe(true);

    expect(telegramBotServiceMock.sendMessage).toHaveBeenCalledWith(
      '-1001234567890',
      '🕊 Зі святом!',
    );
  });

  it('publishes today events during the Kyiv 09:00 hour in winter', async () => {
    const now = new Date('2026-01-16T07:30:00.000Z');
    calendarServiceMock.listToday.mockResolvedValue([]);

    await expect(service.publishIfKyivScheduledTime(now)).resolves.toBe(true);
  });

  it('does not send events outside the Kyiv 09:00 hour', async () => {
    await expect(
      service.publishIfKyivScheduledTime(new Date('2026-08-16T07:30:00.000Z')),
    ).resolves.toBe(false);

    expect(calendarServiceMock.listToday).not.toHaveBeenCalled();
    expect(telegramBotServiceMock.sendMessage).not.toHaveBeenCalled();
  });
});
