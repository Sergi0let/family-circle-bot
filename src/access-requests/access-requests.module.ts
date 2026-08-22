import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AccessRequestsService } from './application/access-requests.service';

@Module({
  imports: [UsersModule],
  providers: [AccessRequestsService],
  exports: [AccessRequestsService],
})
export class AccessRequestsModule {}
