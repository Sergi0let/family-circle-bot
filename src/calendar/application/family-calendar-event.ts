export type CalendarEventSource = 'family' | 'public-holidays';

export interface FamilyCalendarEvent {
  readonly description: string | null;
  readonly htmlLink: string | null;
  readonly iCalUID: string | null;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly source: CalendarEventSource;
  readonly startsOn: string;
  readonly summary: string;
}
