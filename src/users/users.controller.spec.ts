import { ConfigService } from '@nestjs/config';
import { TelegramUsersService } from './application/telegram-users.service';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  const configServiceMock = { get: jest.fn() };
  const telegramUsersServiceMock = { createOrActivate: jest.fn() };
  const controller = new UsersController(
    configServiceMock as unknown as ConfigService,
    telegramUsersServiceMock as unknown as TelegramUsersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockReturnValue('admin-token');
  });

  it('accepts a bearer token and activates a user', async () => {
    telegramUsersServiceMock.createOrActivate.mockResolvedValue({
      telegramUserId: '123456789',
    });

    await expect(
      controller.createOrActivate(
        { telegramUserId: 123456789, firstName: 'Іван' },
        'Bearer admin-token',
        undefined,
      ),
    ).resolves.toEqual({ telegramUserId: '123456789' });

    expect(telegramUsersServiceMock.createOrActivate).toHaveBeenCalledWith({
      telegramUserId: '123456789',
      firstName: 'Іван',
    });
  });

  it('rejects a missing administrator token', async () => {
    await expect(
      controller.createOrActivate(
        { telegramUserId: '123456789' },
        undefined,
        undefined,
      ),
    ).rejects.toThrow('Missing admin API token.');
  });
});
