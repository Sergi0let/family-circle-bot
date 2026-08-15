import { Context } from 'grammy';
import { FamilyGroupsService } from '../families/application/family-groups.service';
import { TelegramUpdatesHandler } from './telegram-updates.handler';

describe('TelegramUpdatesHandler', () => {
  const familyGroupsServiceMock = {
    register: jest.fn(),
  };
  const handler = new TelegramUpdatesHandler(
    familyGroupsServiceMock as unknown as FamilyGroupsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks for confirmation before registering a group', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Family Circle',
      },
      reply,
    };

    await handler.handleStart(context as unknown as Context);

    expect(familyGroupsServiceMock.register).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      'Готовий допомагати з днями народження. Підтвердь активацію цієї групи.',
      expect.any(Object),
    );
  });

  it('registers a group after the activation callback', async () => {
    const familyGroup = {
      id: 'family-group-id',
      telegramChatId: -1001234567890n,
      title: 'Family Circle',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const editMessageText = jest.fn().mockResolvedValue(undefined);
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: -1001234567890,
        type: 'supergroup',
        title: 'Family Circle',
      },
      answerCallbackQuery,
      editMessageText,
      reply,
    };
    familyGroupsServiceMock.register.mockResolvedValue(familyGroup);

    await handler.handleGroupActivation(context as unknown as Context);

    expect(familyGroupsServiceMock.register).toHaveBeenCalledTimes(1);
    expect(editMessageText).toHaveBeenCalledWith(
      'Family Circle активовано для «Family Circle».',
    );
  });

  it('does not allow group activation in a private chat', async () => {
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: { id: 123456789, type: 'private' },
      answerCallbackQuery,
    };

    await handler.handleGroupActivation(context as unknown as Context);

    expect(familyGroupsServiceMock.register).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith({
      text: 'Активація доступна лише у групі.',
      show_alert: true,
    });
  });
});
