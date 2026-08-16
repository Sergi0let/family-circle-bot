import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { GreetingGenerationInput } from '../application/greeting-generator';
import {
  AnthropicMessagesClient,
  ClaudeGreetingRequest,
} from './anthropic-client.provider';
import { ClaudeGreetingGenerator } from './claude-greeting-generator.service';

describe('ClaudeGreetingGenerator', () => {
  const configServiceMock = {
    getOrThrow: jest
      .fn<(key: string) => string>()
      .mockReturnValue('claude-haiku-4-5'),
  };
  const messagesClientMock = {
    generate: jest.fn<(request: ClaudeGreetingRequest) => Promise<unknown>>(),
  };
  const input: GreetingGenerationInput = {
    kind: 'birthday',
    occasion: 'День народження',
    recipientName: 'Олена',
    relation: 'сестра',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates and returns Claude structured output', async () => {
    messagesClientMock.generate.mockResolvedValue({
      text: 'Олено, з Днем народження! Нехай цей рік буде радісним.',
    });
    const service = createService(messagesClientMock);

    await expect(service.generate(input)).resolves.toEqual({
      text: 'Олено, з Днем народження! Нехай цей рік буде радісним.',
    });

    const [firstCall] = messagesClientMock.generate.mock.calls;

    if (firstCall === undefined || firstCall[0].model !== 'claude-haiku-4-5') {
      throw new Error('Claude was not called with the configured model.');
    }
  });

  it('rejects input that exceeds the prompt data limits', async () => {
    const service = createService(messagesClientMock);

    await expect(
      service.generate({ ...input, occasion: 'x'.repeat(121) }),
    ).rejects.toThrow();

    expect(messagesClientMock.generate).not.toHaveBeenCalled();
  });

  it('rejects a response without parsed structured output', async () => {
    messagesClientMock.generate.mockResolvedValue(null);
    const service = createService(messagesClientMock);

    await expect(service.generate(input)).rejects.toThrow(
      'Claude returned no greeting output.',
    );
  });

  function createService(
    messagesClient: AnthropicMessagesClient | null,
  ): ClaudeGreetingGenerator {
    return new ClaudeGreetingGenerator(
      configServiceMock as unknown as ConfigService,
      messagesClient,
    );
  }
});
