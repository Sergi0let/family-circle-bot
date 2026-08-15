import { CalendarDeliveriesService } from '../calendar/application/calendar-deliveries.service';
import { FamilyCalendarService } from '../calendar/application/family-calendar.service';
import { FamilyGroupsService } from '../families/application/family-groups.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramCalendarBroadcastService } from './telegram-calendar-broadcast.service';

describe('TelegramCalendarBroadcastService', () => {
  const group = {
    id: 'family-group-id',
    telegramChatId: -1001234567890n,
    title: 'Family Circle',
    googleCalendarId: 'family@example.com',
  };
  const familyGroupsServiceMock = {
    listWithConnectedCalendar: jest.fn(),
  };
  const familyCalendarServiceMock = {
    listTodayForTelegramChatId: jest.fn(),
  };
  const calendarDeliveriesServiceMock = {
    claimDelivery: jest.fn(),
    releaseClaim: jest.fn(),
  };
  const telegramBotServiceMock = {
    sendMessage: jest.fn(),
  };
  const service = new TelegramCalendarBroadcastService(
    familyGroupsServiceMock as unknown as FamilyGroupsService,
    familyCalendarServiceMock as unknown as FamilyCalendarService,
    calendarDeliveriesServiceMock as unknown as CalendarDeliveriesService,
    telegramBotServiceMock as unknown as TelegramBotService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes one Telegram message for every calendar event', async () => {
    const now = new Date('2026-08-16T05:00:00.000Z');
    familyGroupsServiceMock.listWithConnectedCalendar.mockResolvedValue([
      group,
    ]);
    familyCalendarServiceMock.listTodayForTelegramChatId.mockResolvedValue({
      events: [
        {
          id: 'church-holiday',
          summary: 'Успіння Пресвятої Богородиці',
          startsOn: '2026-08-16',
          isAllDay: true,
          htmlLink: null,
        },
        {
          id: 'birthday',
          summary: 'День народження Олени',
          startsOn: '2026-08-16',
          isAllDay: true,
          htmlLink: null,
        },
      ],
    });
    calendarDeliveriesServiceMock.claimDelivery.mockResolvedValue(true);

    await service.publishToday(now);

    expect(telegramBotServiceMock.sendMessage).toHaveBeenNthCalledWith(
      1,
      group.telegramChatId,
      '🕊 Успіння Пресвятої Богородиці',
    );
    expect(telegramBotServiceMock.sendMessage).toHaveBeenNthCalledWith(
      2,
      group.telegramChatId,
      '🕊 День народження Олени',
    );
    expect(calendarDeliveriesServiceMock.claimDelivery).toHaveBeenCalledTimes(
      2,
    );
  });

  it('does not publish an event that was already sent today', async () => {
    familyGroupsServiceMock.listWithConnectedCalendar.mockResolvedValue([
      group,
    ]);
    familyCalendarServiceMock.listTodayForTelegramChatId.mockResolvedValue({
      events: [
        {
          id: 'church-holiday',
          summary: 'Успіння Пресвятої Богородиці',
          startsOn: '2026-08-16',
          isAllDay: true,
          htmlLink: null,
        },
      ],
    });
    calendarDeliveriesServiceMock.claimDelivery.mockResolvedValue(false);

    await service.publishToday(new Date('2026-08-16T05:00:00.000Z'));

    expect(telegramBotServiceMock.sendMessage).not.toHaveBeenCalled();
    expect(calendarDeliveriesServiceMock.releaseClaim).not.toHaveBeenCalled();
  });

  it('releases a delivery claim when Telegram rejects a message', async () => {
    familyGroupsServiceMock.listWithConnectedCalendar.mockResolvedValue([
      group,
    ]);
    familyCalendarServiceMock.listTodayForTelegramChatId.mockResolvedValue({
      events: [
        {
          id: 'church-holiday',
          summary: 'Успіння Пресвятої Богородиці',
          startsOn: '2026-08-16',
          isAllDay: true,
          htmlLink: null,
        },
      ],
    });
    calendarDeliveriesServiceMock.claimDelivery.mockResolvedValue(true);
    telegramBotServiceMock.sendMessage.mockRejectedValue(
      new Error('Forbidden'),
    );

    await service.publishToday(new Date('2026-08-16T05:00:00.000Z'));

    expect(calendarDeliveriesServiceMock.releaseClaim).toHaveBeenCalledWith(
      group.id,
      'church-holiday',
      '2026-08-16',
    );
  });
});
