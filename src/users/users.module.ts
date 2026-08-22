import { Module } from '@nestjs/common';
import { AccessPolicyService } from './application/access-policy.service';
import { TelegramAccessService } from './application/telegram-access.service';
import { TelegramUsersService } from './application/telegram-users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [AccessPolicyService, TelegramAccessService, TelegramUsersService],
  exports: [TelegramUsersService, TelegramAccessService, TelegramUsersService],
})
export class UsersModule {}
