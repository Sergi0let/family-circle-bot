import { Module } from '@nestjs/common';
import { AccessPolicyService } from './application/access-policy.service';
import { TelegramAccessService } from './application/telegram-access.service';
import { TelegramUsersService } from './application/telegram-users.service';
import { UserAdministrationService } from './application/user-administration.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    AccessPolicyService,
    TelegramAccessService,
    TelegramUsersService,
    UserAdministrationService,
  ],
  exports: [
    TelegramUsersService,
    TelegramAccessService,
    UserAdministrationService,
  ],
})
export class UsersModule {}
