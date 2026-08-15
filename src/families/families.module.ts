import { Module } from '@nestjs/common';
import { FamilyGroupsService } from './application/family-groups.service';

@Module({
  providers: [FamilyGroupsService],
  exports: [FamilyGroupsService],
})
export class FamiliesModule {}
