import { FamilyCalendarEvent } from '../../calendar/application/family-calendar-event';
import { toGreetingGenerationInput } from './greeting-event-classifier';

describe('toGreetingGenerationInput', () => {
  const event = (
    overrides: Partial<FamilyCalendarEvent>,
  ): FamilyCalendarEvent => ({
    description: null,
    htmlLink: null,
    iCalUID: null,
    id: 'event-id',
    isAllDay: true,
    source: 'family',
    startsOn: '2026-08-16',
    summary: 'Подія',
    ...overrides,
  });

  it('classifies PCU events as church greetings', () => {
    expect(
      toGreetingGenerationInput(
        event({
          iCalUID: 'pcu-20260106@family-circle-bot',
          summary: 'Богоявлення Господнє',
        }),
      ),
    ).toEqual({
      kind: 'church',
      occasion: 'Богоявлення Господнє',
    });
  });

  it('accepts the current compact birthday title format', () => {
    expect(
      toGreetingGenerationInput(event({ summary: '🧔‍♀️ день Гея' })),
    ).toEqual({
      kind: 'birthday',
      occasion: 'День народження',
      recipientName: 'Гея',
    });
  });

  it('reads the optional family relationship after a separator', () => {
    expect(
      toGreetingGenerationInput(
        event({ summary: '🎂 День народження Бро | брат' }),
      ),
    ).toEqual({
      kind: 'birthday',
      occasion: 'День народження',
      recipientName: 'Бро',
      relation: 'брат',
    });
  });

  it('uses the event description as the relationship for legacy birthday titles', () => {
    expect(
      toGreetingGenerationInput(
        event({
          description: 'хрещениця',
          summary: '🎂 День народження: Марія',
        }),
      ),
    ).toEqual({
      kind: 'birthday',
      occasion: 'День народження',
      recipientName: 'Марія',
      relation: 'хрещениця',
    });
  });

  it('classifies all-day public-holiday calendar events', () => {
    expect(
      toGreetingGenerationInput(
        event({
          source: 'public-holidays',
          summary: 'День Незалежності України',
        }),
      ),
    ).toEqual({
      kind: 'public',
      occasion: 'День Незалежності України',
    });
  });

  it('does not classify timed events as greetings', () => {
    expect(
      toGreetingGenerationInput(
        event({ isAllDay: false, summary: 'День народження: Олег' }),
      ),
    ).toBeNull();
  });

  it('ignores events that are neither PCU nor birthdays', () => {
    expect(
      toGreetingGenerationInput(event({ description: 'ваавававаі' })),
    ).toBeNull();
  });
});
