import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node scripts/generate-pcu-calendar.mjs <input.txt> <output.ics>',
  );
}

const monthNumbers = new Map([
  ['Січень', 1],
  ['Лютий', 2],
  ['Березень', 3],
  ['Квітень', 4],
  ['Травень', 5],
  ['Червень', 6],
  ['Липень', 7],
  ['Серпень', 8],
  ['Вересень', 9],
  ['Жовтень', 10],
  ['Листопад', 11],
  ['Грудень', 12],
]);

function escapeIcsText(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r?\n/g, '\\n');
}

function toIcsDate(date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function foldIcsLine(line) {
  const chunks = [];
  let current = '';

  for (const character of line) {
    if (Buffer.byteLength(current + character, 'utf8') > 75) {
      chunks.push(current);
      current = ` ${character}`;
      continue;
    }

    current += character;
  }

  chunks.push(current);
  return chunks.join('\r\n');
}

function parseCalendar(source) {
  const yearMatch = source.match(/Церковний календар на (\d{4})-й рік/u);

  if (!yearMatch) {
    throw new Error('The source must start with a calendar year.');
  }

  const year = Number(yearMatch[1]);
  const events = [];
  let month;

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (monthNumbers.has(line)) {
      month = monthNumbers.get(line);
      continue;
    }

    const match = line.match(/^(\d{1,2})\t(?:пн|вт|ср|чт|пт|сб|нд)\t(.+)$/u);

    if (!match) {
      continue;
    }

    if (!month) {
      throw new Error(`Found an event before its month heading: ${line}`);
    }

    const day = Number(match[1]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) {
      throw new Error(`Invalid date in source: ${line}`);
    }

    events.push({ date, summary: match[2] });
  }

  if (events.length !== 365 && events.length !== 366) {
    throw new Error(`Expected 365 or 366 calendar days, received ${events.length}.`);
  }

  return { events, year };
}

const source = await readFile(resolve(inputPath), 'utf8');
const { events, year } = parseCalendar(source);
const calendarLines = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Family Circle Bot//ПЦУ Calendar//UK',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  `X-WR-CALNAME:ПЦУ — церковний календар ${year}`,
  'X-WR-TIMEZONE:Europe/Kyiv',
];

for (const event of events) {
  const nextDate = new Date(event.date);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const dateKey = toIcsDate(event.date);

  calendarLines.push(
    'BEGIN:VEVENT',
    `UID:pcu-${dateKey}@family-circle-bot`,
    `DTSTAMP:${year}0101T000000Z`,
    `DTSTART;VALUE=DATE:${dateKey}`,
    `DTEND;VALUE=DATE:${toIcsDate(nextDate)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    'CATEGORIES:ПЦУ,Церковний календар',
    'STATUS:CONFIRMED',
    'END:VEVENT',
  );
}

calendarLines.push('END:VCALENDAR');
const ics = `${calendarLines.map(foldIcsLine).join('\r\n')}\r\n`;
const destination = resolve(outputPath);

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, ics, 'utf8');

console.log(`Generated ${events.length} events: ${destination}`);
