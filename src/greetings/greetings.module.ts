import { Module } from '@nestjs/common';
import { GreetingGenerator } from './application/greeting-generator';
import { anthropicMessagesClientProvider } from './infrastructure/anthropic-client.provider';
import { ClaudeGreetingGenerator } from './infrastructure/claude-greeting-generator.service';

@Module({
  providers: [
    anthropicMessagesClientProvider,
    ClaudeGreetingGenerator,
    {
      provide: GreetingGenerator,
      useExisting: ClaudeGreetingGenerator,
    },
  ],
  exports: [GreetingGenerator],
})
export class GreetingsModule {}
