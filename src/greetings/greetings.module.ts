import { Module } from '@nestjs/common';
import { GreetingGenerator } from './application/greeting-generator';
import {
  ANTHROPIC_CLIENT,
  anthropicClientProvider,
  anthropicMessagesClientProvider,
} from './infrastructure/anthropic-client.provider';
import { ClaudeGreetingGenerator } from './infrastructure/claude-greeting-generator.service';

@Module({
  providers: [
    anthropicClientProvider,
    anthropicMessagesClientProvider,
    ClaudeGreetingGenerator,
    {
      provide: GreetingGenerator,
      useExisting: ClaudeGreetingGenerator,
    },
  ],
  exports: [GreetingGenerator, ANTHROPIC_CLIENT],
})
export class GreetingsModule {}
