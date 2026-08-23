import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GreetingGenerationInput,
  greetingDraftSchema,
} from '../application/greeting-generator';

export const ANTHROPIC_MESSAGES_CLIENT = Symbol('ANTHROPIC_MESSAGES_CLIENT');
export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

export interface ClaudeGreetingRequest {
  readonly input: GreetingGenerationInput;
  readonly model: string;
  readonly system: string;
}

export interface AnthropicMessagesClient {
  generate(request: ClaudeGreetingRequest): Promise<unknown>;
}

export const anthropicClientProvider: Provider = {
  provide: ANTHROPIC_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Anthropic | null => {
    const apiKey = configService.get<string>('ANTHROPIC_API_KEY');

    return apiKey === undefined ? null : new Anthropic({ apiKey });
  },
};

export const anthropicMessagesClientProvider: Provider = {
  provide: ANTHROPIC_MESSAGES_CLIENT,
  inject: [ANTHROPIC_CLIENT],
  useFactory: (client: Anthropic | null): AnthropicMessagesClient | null => {
    if (client === null) {
      return null;
    }

    return {
      async generate({ input, model, system }): Promise<unknown> {
        const response = await client.messages.parse({
          model,
          max_tokens: 160,
          system,
          messages: [
            {
              role: 'user',
              content: JSON.stringify(input),
            },
          ],
          output_config: {
            format: zodOutputFormat(greetingDraftSchema),
          },
        });

        return response.parsed_output;
      },
    };
  },
};
