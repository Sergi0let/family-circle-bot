-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TelegramUserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED');

-- CreateTable
CREATE TABLE "telegram_users" (
    "id" TEXT NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "private_chat_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "username" TEXT,
    "status" "TelegramUserStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_users_telegram_user_id_key" ON "telegram_users"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_users_private_chat_id_key" ON "telegram_users"("private_chat_id");
