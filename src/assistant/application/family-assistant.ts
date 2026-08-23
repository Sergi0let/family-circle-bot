export abstract class FamilyAssistant {
  abstract answer(question: string): Promise<string>;
}
