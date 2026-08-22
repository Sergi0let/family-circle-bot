import { Context, Bot } from 'grammy';
import { CalendarService } from '../calendar/application/calendar.service';
import { TelegramAccessService } from '../users/application/telegram-access.service';
import { TelegramMemberMenuHandler } from './telegram-member-menu.handler';

describe('TelegramMemberMenuHandler', () => {
  const telegramAccessServiceMock = { resolveAccess: jest.fn() };
  const calendarServiceMock = {
    listBirthdays: jest.fn(),
    listBirthdaysThisMonth: jest.fn(),
    listToday: jest.fn(),
  };
  const handler = new TelegramMemberMenuHandler(
    telegramAccessServiceMock as unknown as TelegramAccessService,
    calendarServiceMock as unknown as CalendarService,
  );
  const callbacks = new Map<string, (context: Context) => Promise<void>>();

  beforeEach(() => {
    jest.clearAllMocks();
    callbacks.clear();
    telegramAccessServiceMock.resolveAccess.mockResolvedValue({
      kind: 'ACTIVE',
      user: { firstName: 'Іван' },
    });
  });

  function registerCallbacks(): void {
    const callbackQuery = jest.fn(
      (callbackData: string, callback: (context: Context) => Promise<void>) => {
        callbacks.set(callbackData, callback);
      },
    );
    const bot = { callbackQuery, command: jest.fn() };

    handler.register(bot as unknown as Bot<Context>);
  }

  function createContext() {
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const reply = jest.fn().mockResolvedValue(undefined);

    return {
      answerCallbackQuery,
      context: {
        chat: { id: 123456789, type: 'private' },
        from: { id: 123456789, first_name: 'Іван' },
        reply,
        answerCallbackQuery,
      } as unknown as Context,
      reply,
    };
  }

  it('shows today occasions from the menu button to an active member', async () => {
    calendarServiceMock.listToday.mockResolvedValue([
      { summary: 'День Незалежності України' },
    ]);
    registerCallbacks();
    const { answerCallbackQuery, context, reply } = createContext();

    const menuHandler = callbacks.get('menu:today');
    expect(menuHandler).toBeDefined();

    await menuHandler!(context);

    expect(answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(calendarServiceMock.listToday).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith(
      '📅 Сьогодні:\n• День Незалежності України',
    );
  });

  it('shows all birthday entries from the menu button', async () => {
    calendarServiceMock.listBirthdays.mockResolvedValue([
      { name: 'Олена', relation: 'сестра', startsOn: '2026-08-24' },
    ]);
    registerCallbacks();
    const { context, reply } = createContext();

    const menuHandler = callbacks.get('menu:birthdays');
    expect(menuHandler).toBeDefined();

    await menuHandler!(context);

    expect(calendarServiceMock.listBirthdays).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith(
      '🎂 Усі дні народження\n• 24 серпня — Олена',
    );
  });

  it('shows birthday entries for the current month from the menu button', async () => {
    calendarServiceMock.listBirthdaysThisMonth.mockResolvedValue([
      { name: 'Олег', startsOn: '2026-08-24' },
    ]);
    registerCallbacks();
    const { context, reply } = createContext();

    const menuHandler = callbacks.get('menu:birthdays:month');
    expect(menuHandler).toBeDefined();

    await menuHandler!(context);

    expect(calendarServiceMock.listBirthdaysThisMonth).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith(
      expect.stringContaining('• 24 серпня — Олег'),
    );
  });

  it('shows a short description of the bot functions', async () => {
    registerCallbacks();
    const { context, reply } = createContext();

    const menuHandler = callbacks.get('menu:info');
    expect(menuHandler).toBeDefined();

    await menuHandler!(context);

    expect(reply).toHaveBeenCalledWith(
      'ℹ️ Family Circle показує події на сьогодні, усі дні народження та дні народження поточного місяця. Дані доступні лише підтвердженим учасникам сім’ї.',
    );
  });
});
