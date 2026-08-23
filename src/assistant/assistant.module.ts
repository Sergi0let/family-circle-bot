import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { GreetingsModule } from '../greetings/greetings.module';
import { FamilyAssistant } from './application/family-assistant';
import { ClaudeFamilyAssistantService } from './infrastructure/claude-family-assistant.service';

@Module({
  imports: [CalendarModule, GreetingsModule],
  providers: [
    ClaudeFamilyAssistantService,
    {
      provide: FamilyAssistant,
      useExisting: ClaudeFamilyAssistantService,
    },
  ],
  exports: [FamilyAssistant],
})
export class AssistantModule {}
