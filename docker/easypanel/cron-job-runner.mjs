import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const scripts = {
  publish: '/app/dist/cron/publish-calendar.js',
  verify: '/app/dist/cron/verify-calendar.js',
};

const job = process.argv[2];
const script = scripts[job];

if (script === undefined) {
  throw new Error(`Unsupported cron job: ${job ?? 'undefined'}`);
}

const environment = JSON.parse(
  readFileSync('/app/.runtime-env.json', 'utf8'),
);
const child = spawn(process.execPath, [script], {
  env: environment,
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error('Cron job process could not start.', error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (code === 0) {
    return;
  }

  console.error(`Cron job stopped with code ${code} and signal ${signal}.`);
  process.exitCode = 1;
});
