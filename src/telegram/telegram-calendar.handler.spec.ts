import { Context } from 'grammy';
import { CalendarConnectionsService } from '../calendar/application/calendar-connections.service';
import { FamilyCalendarService } from '../calendar/application/family-calendar.service';
import { FamilyGroupsService } from '../families/application/family-groups.service';
import { PendingCalendarConnectionStore } from './pending-calendar-connection.store';
import { TelegramCalendarHandler } from './telegram-calendar.handler';

describe('TelegramCalendarHandler', () => {
  const familyGroup = {
    id: 'family-group-id',
    telegramChatId: -1001234567890n,
    title: 'Family Circle',
    googleCalendarId: null,
  };
  const familyGroupsServiceMock = {
    findByTelegramChatId: jest.fn(),
  };
  const calendarConnectionsServiceMock = {
    connectGoogleCalendar: jest.fn(),
  };
  const familyCalendarServiceMock = {
    listTodayForTelegramChatId: jest.fn(),
  };
  let drafts: PendingCalendarConnectionStore;
  let handler: TelegramCalendarHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    drafts = new PendingCalendarConnectionStore();
    handler = new TelegramCalendarHandler(
      familyGroupsServiceMock as unknown as FamilyGroupsService,
      calendarConnectionsServiceMock as unknown as CalendarConnectionsService,
      familyCalendarServiceMock as unknown as FamilyCalendarService,
      drafts,
    );
  });

  it('creates a confirmation draft instead of immediately connecting a calendar', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: Number(familyGroup.telegramChatId),
        type: 'supergroup',
        title: familyGroup.title,
      },
      from: { id: 12345 },
      message: { text: '/calendar_connect family@example.com' },
      reply,
    };
    familyGroupsServiceMock.findByTelegramChatId.mockResolvedValue(familyGroup);

    await handler.handleCalendarConnect(context as unknown as Context);

    expect(
      calendarConnectionsServiceMock.connectGoogleCalendar,
    ).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.stringContaining('Чернетка підключення Google Calendar:'),
      expect.any(Object),
    );
  });

  it('connects a calendar only after the draft author confirms it', async () => {
    const draft = drafts.create({
      chatId: Number(familyGroup.telegramChatId),
      requestedByUserId: 12345,
      input: {
        familyGroupId: familyGroup.id,
        googleCalendarId: 'family@example.com',
      },
    });
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const editMessageText = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: Number(familyGroup.telegramChatId),
        type: 'supergroup',
        title: familyGroup.title,
      },
      from: { id: 12345 },
      callbackQuery: { data: `calendar-connect:confirm:${draft.id}` },
      answerCallbackQuery,
      editMessageText,
    };

    await handler.handleCalendarConnectionCallback(
      context as unknown as Context,
    );

    expect(
      calendarConnectionsServiceMock.connectGoogleCalendar,
    ).toHaveBeenCalledTimes(1);
    expect(editMessageText).toHaveBeenCalledWith(
      'Google Calendar підключено. Перевір події командою /calendar_today.',
    );
  });
});
