import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from '../../calendar/application/calendar.service';
import { ClaudeFamilyAssistantService } from './claude-family-assistant.service';

describe('ClaudeFamilyAssistantService', () => {
  const configServiceMock = { get: jest.fn(), getOrThrow: jest.fn() };
  const calendarServiceMock = {
    listBirthdays: jest.fn(),
    listFamilyEventsInDateRange: jest.fn(),
    listToday: jest.fn(),
  };
  const messagesCreate = jest.fn();
  const clientMock = { messages: { create: messagesCreate } };
  const service = new ClaudeFamilyAssistantService(
    configServiceMock as unknown as ConfigService,
    calendarServiceMock as unknown as CalendarService,
    clientMock as unknown as Anthropic,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockReturnValue('Europe/Kyiv');
    configServiceMock.getOrThrow.mockReturnValue('claude-test');
  });

  it('uses the today tool and returns Claude’s final answer', async () => {
    messagesCreate
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_today',
            name: 'list_today_events',
            input: {},
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Сьогодні: сімейна вечеря о 19:00.' }],
      });
    calendarServiceMock.listToday.mockResolvedValue([
      {
        description: 'Не передавати Claude',
        htmlLink: 'https://calendar.google.com/event',
        iCalUID: 'internal-id',
        id: 'event-id',
        isAllDay: false,
        source: 'family',
        startsOn: '2026-08-23',
        summary: 'Сімейна вечеря',
      },
    ]);

    await expect(service.answer('Що сьогодні?')).resolves.toBe(
      'Сьогодні: сімейна вечеря о 19:00.',
    );

    expect(calendarServiceMock.listToday).toHaveBeenCalledTimes(1);
    expect(messagesCreate).toHaveBeenCalledTimes(2);
  });

  it('validates the date range and does not call Calendar for invalid tool input', async () => {
    messagesCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_range',
          name: 'list_events_in_range',
          input: { from: '2026-08-30', to: '2026-08-01' },
        },
      ],
    });

    await expect(service.answer('Які події в серпні?')).rejects.toThrow();

    expect(
      calendarServiceMock.listFamilyEventsInDateRange,
    ).not.toHaveBeenCalled();
  });
});
