import { Module } from '@nestjs/common';
import { FamilyGroupsService } from './application/family-groups.service';
import { FamilyMembersService } from './application/family-members.service';

@Module({
  providers: [FamilyGroupsService, FamilyMembersService],
  exports: [FamilyGroupsService, FamilyMembersService],
})
export class FamiliesModule {}
