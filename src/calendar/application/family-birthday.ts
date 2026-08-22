import { FamilyCalendarEvent } from './family-calendar-event';

export interface FamilyBirthday {
  readonly name: string;
  readonly relation?: string;
  readonly startsOn: string;
}

const BIRTHDAY_TITLE_PATTERN =
  /^(?:🎂|🧔‍♀️)?\s*день\s+народження\s*:?\s+(?<recipientName>[^|]+?)(?:\s*\|\s*(?<relation>.+))?$/iu;

function shorten(value: string, maximumLength: number): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();

  if (Array.from(normalized).length <= maximumLength) {
    return normalized;
  }

  return `${Array.from(normalized)
    .slice(0, maximumLength - 1)
    .join('')}…`;
}

export function toFamilyBirthday(
  event: FamilyCalendarEvent,
): FamilyBirthday | null {
  if (!event.isAllDay) {
    return null;
  }

  const birthday = BIRTHDAY_TITLE_PATTERN.exec(event.summary);

  if (birthday?.groups?.recipientName === undefined) {
    return null;
  }

  const name = shorten(birthday.groups.recipientName, 80);

  if (name.length === 0) {
    return null;
  }

  const relation = birthday.groups.relation?.trim() || event.description;

  return {
    name,
    startsOn: event.startsOn,
    ...(relation === null || relation.length === 0
      ? {}
      : { relation: shorten(relation, 80) }),
  };
}
