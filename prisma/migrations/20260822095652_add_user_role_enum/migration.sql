-- CreateEnum
CREATE TYPE "TelegramUserRole" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');

-- AlterTable
ALTER TABLE "telegram_users" ADD COLUMN     "role" "TelegramUserRole" NOT NULL DEFAULT 'MEMBER';
