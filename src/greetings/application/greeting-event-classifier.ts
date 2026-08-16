import { FamilyCalendarEvent } from '../../calendar/application/family-calendar-event';
import {
  GreetingGenerationInput,
  greetingGenerationInputSchema,
} from './greeting-generator';

const BIRTHDAY_TITLE_PATTERN =
  /^(?:🎂|🧔‍♀️)?\s*день(?:\s+народження)?\s*:?\s+(?<recipientName>[^|]+?)(?:\s*\|\s*(?<relation>.+))?$/iu;

function shorten(value: string, maximumLength: number): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();

  if (Array.from(normalized).length <= maximumLength) {
    return normalized;
  }

  return `${Array.from(normalized)
    .slice(0, maximumLength - 1)
    .join('')}…`;
}

export function toGreetingGenerationInput(
  event: FamilyCalendarEvent,
): GreetingGenerationInput | null {
  if (event.source === 'public-holidays' && event.isAllDay) {
    return greetingGenerationInputSchema.parse({
      kind: 'public',
      occasion: shorten(event.summary, 120),
    });
  }

  if (event.iCalUID?.startsWith('pcu-') === true && event.isAllDay) {
    return greetingGenerationInputSchema.parse({
      kind: 'church',
      occasion: shorten(event.summary, 120),
    });
  }

  if (!event.isAllDay) {
    return null;
  }

  const birthday = BIRTHDAY_TITLE_PATTERN.exec(event.summary);

  if (birthday?.groups?.recipientName === undefined) {
    return null;
  }

  const recipientName = shorten(birthday.groups.recipientName, 80);
  const relation = birthday.groups.relation?.trim() || event.description;

  if (recipientName.length === 0) {
    return null;
  }

  return greetingGenerationInputSchema.parse({
    kind: 'birthday',
    occasion: 'День народження',
    recipientName,
    ...(relation === null || relation.length === 0
      ? {}
      : { relation: shorten(relation, 80) }),
  });
}
