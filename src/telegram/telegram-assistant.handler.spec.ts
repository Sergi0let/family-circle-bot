import { Context } from 'grammy';
import { TelegramAccessService } from '../users/application/telegram-access.service';
import { TelegramAssistantHandler } from './telegram-assistant.handler';

describe('TelegramAssistantHandler', () => {
  const familyAssistantMock = { answer: jest.fn() };
  const telegramAccessServiceMock = { resolveAccess: jest.fn() };
  const handler = new TelegramAssistantHandler(
    familyAssistantMock,
    telegramAccessServiceMock as unknown as TelegramAccessService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    telegramAccessServiceMock.resolveAccess.mockResolvedValue({
      kind: 'ACTIVE',
      user: { firstName: 'Іван' },
    });
  });

  it('sends a private active member question to the family assistant', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    familyAssistantMock.answer.mockResolvedValue('Сьогодні подій немає.');

    await (
      handler as unknown as { handleAsk: (context: Context) => Promise<void> }
    ).handleAsk({
      chat: { id: 123, type: 'private' },
      from: { id: 123, first_name: 'Іван' },
      message: { text: '/ask Що сьогодні?' },
      reply,
    } as unknown as Context);

    expect(familyAssistantMock.answer).toHaveBeenCalledWith('Що сьогодні?');
    expect(reply).toHaveBeenCalledWith('Сьогодні подій немає.');
  });

  it('accepts a regular private text message without the /ask command', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    familyAssistantMock.answer.mockResolvedValue('Найближча подія — у суботу.');

    await (
      handler as unknown as {
        handleTextMessage: (context: Context) => Promise<void>;
      }
    ).handleTextMessage({
      chat: { id: 123, type: 'private' },
      from: { id: 123, first_name: 'Іван' },
      message: { text: 'Коли найближча сімейна подія?' },
      reply,
    } as unknown as Context);

    expect(familyAssistantMock.answer).toHaveBeenCalledWith(
      'Коли найближча сімейна подія?',
    );
    expect(reply).toHaveBeenCalledWith('Найближча подія — у суботу.');
  });

  it('does not pass bot commands to the assistant text handler', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);

    await (
      handler as unknown as {
        handleTextMessage: (context: Context) => Promise<void>;
      }
    ).handleTextMessage({
      chat: { id: 123, type: 'private' },
      from: { id: 123, first_name: 'Іван' },
      message: { text: '/start' },
      reply,
    } as unknown as Context);

    expect(telegramAccessServiceMock.resolveAccess).not.toHaveBeenCalled();
    expect(familyAssistantMock.answer).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it('does not give pending users access to the assistant', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    telegramAccessServiceMock.resolveAccess.mockResolvedValue({
      kind: 'PENDING',
      user: {},
    });

    await (
      handler as unknown as { handleAsk: (context: Context) => Promise<void> }
    ).handleAsk({
      chat: { id: 123, type: 'private' },
      from: { id: 123, first_name: 'Іван' },
      message: { text: '/ask Що сьогодні?' },
      reply,
    } as unknown as Context);

    expect(familyAssistantMock.answer).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      'Відкрийте /start, щоб перевірити стан доступу.',
    );
  });
});
