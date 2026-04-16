import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { startServer } from './server.js';

// ── Config ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));

// ── CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const envFlag = args.indexOf('--env');
const envArg = envFlag !== -1 ? args[envFlag + 1] : null;

if (envArg) {
  // Direct start — match by id or name (case-insensitive)
  const env = config.environments.find(
    e => e.id === envArg || e.name.toLowerCase() === envArg.toLowerCase()
  );
  if (!env) {
    process.stderr.write(`Environment "${envArg}" not found.\n`);
    process.stderr.write(`Available: ${config.environments.map(e => e.id).join(', ')}\n`);
    process.exit(1);
  }
  startServer(config, env);
} else if (config.environments.length === 1) {
  // Single environment — skip picker
  startServer(config, config.environments[0]);
} else {
  // Interactive environment picker
  pickEnvironment(config.environments).then((env) => {
    startServer(config, env);
  });
}

// ── TUI: Arrow-key environment selector ─────────────────────────────
async function pickEnvironment(environments) {
  let selected = 0;
  const defaultIdx = environments.findIndex(e => e.id === config.activeEnvironment);
  if (defaultIdx !== -1) selected = defaultIdx;

  const write = (s) => process.stdout.write(s);

  function render() {
    // Move cursor up to overwrite previous render (except first time)
    write('\x1B[2J\x1B[H'); // clear screen, cursor to top
    write('  night-worcoon cli\n');
    write('  ─────────────────\n');
    write('  Select environment (↑/↓, Enter):\n\n');
    for (let i = 0; i < environments.length; i++) {
      const e = environments[i];
      const marker = i === selected ? '▸' : ' ';
      const highlight = i === selected ? '\x1B[36m' : '\x1B[90m';
      write(`  ${highlight}${marker} ${e.name}\x1B[0m`);
      if (i === selected) write(`  \x1B[90m→ ${e.targetUrl}\x1B[0m`);
      write('\n');
    }
    write('\n');
  }

  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Non-interactive — fall back to activeEnvironment from config
      const env = environments.find(e => e.id === config.activeEnvironment) || environments[0];
      return resolve(env);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    render();

    process.stdin.on('data', (key) => {
      if (key === '\x1B[A') { // up
        selected = (selected - 1 + environments.length) % environments.length;
        render();
      } else if (key === '\x1B[B') { // down
        selected = (selected + 1) % environments.length;
        render();
      } else if (key === '\r' || key === '\n') { // enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(environments[selected]);
      } else if (key === '\x03') { // ctrl+c
        process.stdout.write('\n');
        process.exit(0);
      }
    });
  });
}
