import { toFamilyBirthday } from '../../calendar/application/family-birthday';
import { FamilyCalendarEvent } from '../../calendar/application/family-calendar-event';
import {
  GreetingGenerationInput,
  greetingGenerationInputSchema,
} from './greeting-generator';

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

  const birthday = toFamilyBirthday(event);

  if (birthday === null) {
    return null;
  }

  return greetingGenerationInputSchema.parse({
    kind: 'birthday',
    occasion: 'День народження',
    recipientName: birthday.name,
    ...(birthday.relation === undefined ? {} : { relation: birthday.relation }),
  });
}
