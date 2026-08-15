import { Context } from 'grammy';
import { FamilyGroupsService } from '../families/application/family-groups.service';
import { FamilyMembersService } from '../families/application/family-members.service';
import { PendingMemberAdditionStore } from './pending-member-addition.store';
import { TelegramMemberAddHandler } from './telegram-member-add.handler';

describe('TelegramMemberAddHandler', () => {
  const familyGroup = {
    id: 'family-group-id',
    telegramChatId: -1001234567890n,
    title: 'Family Circle',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const familyGroupsServiceMock = {
    findByTelegramChatId: jest.fn(),
  };
  const familyMembersServiceMock = {
    create: jest.fn(),
  };
  let drafts: PendingMemberAdditionStore;
  let handler: TelegramMemberAddHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    drafts = new PendingMemberAdditionStore();
    handler = new TelegramMemberAddHandler(
      familyGroupsServiceMock as unknown as FamilyGroupsService,
      familyMembersServiceMock as unknown as FamilyMembersService,
      drafts,
    );
  });

  it('creates a draft instead of writing a member immediately', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: Number(familyGroup.telegramChatId),
        type: 'supergroup',
        title: familyGroup.title,
      },
      from: { id: 12345 },
      message: { text: '/member_add Olena; Koval; 1990-05-14' },
      reply,
    };
    familyGroupsServiceMock.findByTelegramChatId.mockResolvedValue(familyGroup);

    await handler.handleMemberAdd(context as unknown as Context);

    expect(familyMembersServiceMock.create).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.stringContaining('Чернетка нового члена родини:'),
      expect.any(Object),
    );
  });

  it('writes a member only after its author confirms the draft', async () => {
    const draft = drafts.create({
      chatId: Number(familyGroup.telegramChatId),
      requestedByUserId: 12345,
      input: {
        familyGroupId: familyGroup.id,
        firstName: 'Olena',
        lastName: 'Koval',
        birthDate: new Date('1990-05-14T00:00:00.000Z'),
      },
    });
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const editMessageText = jest.fn().mockResolvedValue(undefined);
    const reply = jest.fn().mockResolvedValue(undefined);
    const context = {
      chat: {
        id: Number(familyGroup.telegramChatId),
        type: 'supergroup',
        title: familyGroup.title,
      },
      from: { id: 12345 },
      callbackQuery: { data: `member-add:confirm:${draft.id}` },
      answerCallbackQuery,
      editMessageText,
      reply,
    };
    familyMembersServiceMock.create.mockResolvedValue({
      ...draft.input,
      id: 'member-id',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await handler.handleMemberAdditionCallback(context as unknown as Context);

    expect(familyMembersServiceMock.create).toHaveBeenCalledTimes(1);
    expect(editMessageText).toHaveBeenCalledWith('Додано: Olena (1990-05-14).');
  });

  it('does not claim unrelated text messages', async () => {
    const context = {
      chat: {
        id: Number(familyGroup.telegramChatId),
        type: 'supergroup',
        title: familyGroup.title,
      },
      from: { id: 12345 },
      message: { text: '📅 Сьогодні' },
    };

    await expect(
      handler.handleMenuReply(context as unknown as Context),
    ).resolves.toBe(false);
  });
});
