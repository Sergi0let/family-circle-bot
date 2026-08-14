-- CreateTable
CREATE TABLE "FamilyGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramChatId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyGroupId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "birthDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyMember_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGroup_telegramChatId_key" ON "FamilyGroup"("telegramChatId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyGroupId_birthDate_idx" ON "FamilyMember"("familyGroupId", "birthDate");
