import { Context, Keyboard } from 'grammy';

export const BIRTHDAYS_MENU_ACTION = '🎂 Дні народження';
export const MEMBER_ADD_MENU_ACTION = '➕ Додати члена';
export const CALENDAR_TODAY_MENU_ACTION = '📅 Сьогодні';

export function createFamilyMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text(BIRTHDAYS_MENU_ACTION)
    .text(MEMBER_ADD_MENU_ACTION)
    .row()
    .text(CALENDAR_TODAY_MENU_ACTION)
    .resized()
    .persistent();
}

export async function replyWithFamilyMenu(
  context: Context,
  text: string,
): Promise<void> {
  await context.reply(text, { reply_markup: createFamilyMenuKeyboard() });
}
