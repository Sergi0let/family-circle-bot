import { PrismaService } from '../../prisma/prisma.service';
import { confirmedWrite } from './confirmed-write';
import {
  FamilyGroupNotFoundError,
  FamilyMemberNotFoundError,
  FamilyMembersService,
} from './family-members.service';

describe('FamilyMembersService', () => {
  const familyGroupId = 'family-group-id';
  const member = {
    id: 'member-id',
    familyGroupId,
    firstName: 'Olena',
    lastName: 'Koval',
    birthDate: new Date('1990-05-14T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prismaMock = {
    familyGroup: {
      findUnique: jest.fn(),
    },
    familyMember: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new FamilyMembersService(
    prismaMock as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a member in an existing family group after confirmation', async () => {
    prismaMock.familyGroup.findUnique.mockResolvedValue({ id: familyGroupId });
    prismaMock.familyMember.create.mockResolvedValue(member);

    const result = await service.create(
      confirmedWrite({
        familyGroupId,
        firstName: '  Olena ',
        lastName: ' Koval ',
        birthDate: member.birthDate,
      }),
    );

    expect(result).toEqual(member);
    expect(prismaMock.familyMember.create).toHaveBeenCalledWith({
      data: {
        familyGroupId,
        firstName: 'Olena',
        lastName: 'Koval',
        birthDate: member.birthDate,
      },
    });
  });

  it('rejects member creation when the family group does not exist', async () => {
    prismaMock.familyGroup.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        confirmedWrite({
          familyGroupId,
          firstName: member.firstName,
          lastName: member.lastName,
          birthDate: member.birthDate,
        }),
      ),
    ).rejects.toThrow(FamilyGroupNotFoundError);
    expect(prismaMock.familyMember.create).not.toHaveBeenCalled();
  });

  it('lists members in deterministic birthday order', async () => {
    prismaMock.familyMember.findMany.mockResolvedValue([member]);

    await expect(service.listByFamilyGroupId(familyGroupId)).resolves.toEqual([
      member,
    ]);
    expect(prismaMock.familyMember.findMany).toHaveBeenCalledWith({
      where: { familyGroupId },
      orderBy: [{ birthDate: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('updates only a member that belongs to the family group', async () => {
    const updatedMember = { ...member, lastName: null };
    prismaMock.familyMember.findFirst.mockResolvedValue(member);
    prismaMock.familyMember.update.mockResolvedValue(updatedMember);

    await expect(
      service.update(
        confirmedWrite({
          familyGroupId,
          memberId: member.id,
          lastName: '   ',
        }),
      ),
    ).resolves.toEqual(updatedMember);
    expect(prismaMock.familyMember.findFirst).toHaveBeenCalledWith({
      where: { id: member.id, familyGroupId },
    });
    expect(prismaMock.familyMember.update).toHaveBeenCalledWith({
      where: { id: member.id },
      data: { lastName: null },
    });
  });

  it('does not update a member outside the family group', async () => {
    prismaMock.familyMember.findFirst.mockResolvedValue(null);

    await expect(
      service.update(
        confirmedWrite({
          familyGroupId,
          memberId: member.id,
          firstName: 'Iryna',
        }),
      ),
    ).rejects.toThrow(FamilyMemberNotFoundError);
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
  });

  it('deletes only a member that belongs to the family group', async () => {
    prismaMock.familyMember.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.delete(confirmedWrite({ familyGroupId, memberId: member.id })),
    ).resolves.toBeUndefined();
    expect(prismaMock.familyMember.deleteMany).toHaveBeenCalledWith({
      where: { id: member.id, familyGroupId },
    });
  });
});
