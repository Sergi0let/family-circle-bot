import { TelegramUserRole, TelegramUserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserAdministrationService } from './user-administration.service';

describe('UserAdministrationService', () => {
  const administrator = {
    id: 'admin-record',
    telegramUserId: '1',
    status: TelegramUserStatus.ACTIVE,
    role: TelegramUserRole.ADMIN,
  };
  const targetAdministrator = {
    id: 'target-record',
    telegramUserId: '2',
    status: TelegramUserStatus.ACTIVE,
    role: TelegramUserRole.ADMIN,
  };
  const transactionMock = {
    telegramUser: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  type TransactionOperation = (
    transaction: typeof transactionMock,
  ) => Promise<unknown>;
  const prismaMock = {
    $transaction: jest.fn(),
    telegramUser: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const service = new UserAdministrationService(
    prismaMock as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (operation: TransactionOperation) => operation(transactionMock),
    );
  });

  it('does not allow an administrator to change their own role', async () => {
    transactionMock.telegramUser.findFirst.mockResolvedValue(administrator);
    transactionMock.telegramUser.findUnique.mockResolvedValue(administrator);

    await expect(
      service.changeRole('1', '1', TelegramUserRole.MEMBER),
    ).rejects.toThrow('cannot change their own status or role');

    expect(transactionMock.telegramUser.update).not.toHaveBeenCalled();
  });

  it('preserves the final active administrator', async () => {
    transactionMock.telegramUser.findFirst.mockResolvedValue(administrator);
    transactionMock.telegramUser.findUnique.mockResolvedValue(
      targetAdministrator,
    );
    transactionMock.telegramUser.count.mockResolvedValue(1);

    await expect(
      service.changeStatus('1', '2', TelegramUserStatus.BLOCKED),
    ).rejects.toThrow('At least one active administrator must remain');

    expect(transactionMock.telegramUser.update).not.toHaveBeenCalled();
  });

  it('updates another administrator when at least one active admin remains', async () => {
    const updatedUser = {
      ...targetAdministrator,
      role: TelegramUserRole.MODERATOR,
    };
    transactionMock.telegramUser.findFirst.mockResolvedValue(administrator);
    transactionMock.telegramUser.findUnique.mockResolvedValue(
      targetAdministrator,
    );
    transactionMock.telegramUser.count.mockResolvedValue(2);
    transactionMock.telegramUser.update.mockResolvedValue(updatedUser);

    await expect(
      service.changeRole('1', '2', TelegramUserRole.MODERATOR),
    ).resolves.toEqual(updatedUser);

    expect(transactionMock.telegramUser.update).toHaveBeenCalledWith({
      where: { id: 'target-record' },
      data: { role: TelegramUserRole.MODERATOR },
    });
  });

  it('deletes a user and their cascading relations after confirmation logic authorizes it', async () => {
    transactionMock.telegramUser.findFirst.mockResolvedValue(administrator);
    transactionMock.telegramUser.findUnique.mockResolvedValue({
      ...targetAdministrator,
      role: TelegramUserRole.MEMBER,
    });
    transactionMock.telegramUser.delete.mockResolvedValue(targetAdministrator);

    await expect(service.deleteUser('1', '2')).resolves.toBeUndefined();

    expect(transactionMock.telegramUser.delete).toHaveBeenCalledWith({
      where: { id: 'target-record' },
    });
  });
});
