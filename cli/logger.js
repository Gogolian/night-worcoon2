export function createLogger(logLevel) {
  return {
    log(level, message) {
      if (logLevel >= level) process.stdout.write(message + '\n');
    }
  };
}

export function formatTime() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
