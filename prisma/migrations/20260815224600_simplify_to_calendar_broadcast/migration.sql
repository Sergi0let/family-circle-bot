DROP TABLE "FamilyMember";

CREATE TABLE "CalendarEventDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyGroupId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "occurrenceDate" DATETIME NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEventDelivery_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CalendarEventDelivery_familyGroupId_calendarEventId_occurrenceDate_key" ON "CalendarEventDelivery"("familyGroupId", "calendarEventId", "occurrenceDate");
