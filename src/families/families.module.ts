import { Module } from '@nestjs/common';
import { BirthdaysService } from './application/birthdays.service';
import { FamilyGroupsService } from './application/family-groups.service';
import { FamilyMembersService } from './application/family-members.service';

@Module({
  providers: [FamilyGroupsService, FamilyMembersService, BirthdaysService],
  exports: [FamilyGroupsService, FamilyMembersService, BirthdaysService],
})
export class FamiliesModule {}
