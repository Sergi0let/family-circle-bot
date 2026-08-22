import { Context, InlineKeyboard } from 'grammy';
import { AccessRequestsService } from '../access-requests/application/access-requests.service';
import { TelegramAccessRequestsHandler } from './telegram-access-requests.handler';

describe('TelegramAccessRequestsHandler', () => {
  const accessRequestsServiceMock = { approve: jest.fn(), reject: jest.fn() };
  const handler = new TelegramAccessRequestsHandler(
    accessRequestsServiceMock as unknown as AccessRequestsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends approved applicants a button that opens the menu', async () => {
    accessRequestsServiceMock.approve.mockResolvedValue({
      applicant: { privateChatId: '123456789' },
    });
    const reply = jest.fn().mockResolvedValue(undefined);
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const sendMessage = jest.fn().mockResolvedValue(undefined);

    await (
      handler as unknown as {
        decide: (
          context: Context,
          requestId: string,
          decision: 'approve',
        ) => Promise<void>;
      }
    ).decide(
      {
        chat: { id: 987654321, type: 'private' },
        from: { id: 987654321, first_name: 'Адмін' },
        reply,
        answerCallbackQuery,
        api: { sendMessage },
      } as unknown as Context,
      'request1',
      'approve',
    );

    expect(sendMessage).toHaveBeenCalledWith(
      '123456789',
      '✅ Ваш доступ до Family Circle підтверджено. Відкрийте меню кнопкою нижче.',
      {
        reply_markup: new InlineKeyboard().text(
          '▶️ Відкрити меню',
          'menu:open',
        ),
      },
    );
  });
});
