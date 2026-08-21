import { Module } from '@nestjs/common';
import { TelegramUsersService } from './application/telegram-users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [TelegramUsersService],
  exports: [TelegramUsersService],
})
export class UsersModule {}
