-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TelegramUserStatus" ADD VALUE 'REJECTED';

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "applicant_user_id" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_applicant_user_id_key" ON "access_requests"("applicant_user_id");

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
