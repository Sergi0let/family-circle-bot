import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GreetingGenerationInput,
  greetingDraftSchema,
} from '../application/greeting-generator';

export const ANTHROPIC_MESSAGES_CLIENT = Symbol('ANTHROPIC_MESSAGES_CLIENT');

export interface ClaudeGreetingRequest {
  readonly input: GreetingGenerationInput;
  readonly model: string;
  readonly system: string;
}

export interface AnthropicMessagesClient {
  generate(request: ClaudeGreetingRequest): Promise<unknown>;
}

export const anthropicMessagesClientProvider: Provider = {
  provide: ANTHROPIC_MESSAGES_CLIENT,
  inject: [ConfigService],
  useFactory: (
    configService: ConfigService,
  ): AnthropicMessagesClient | null => {
    const apiKey = configService.get<string>('ANTHROPIC_API_KEY');

    if (apiKey === undefined) {
      return null;
    }

    const client = new Anthropic({ apiKey });

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
