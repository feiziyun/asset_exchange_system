const fs = require('fs');
const path = require('path');

const parseValue = (value) => {
  const trimmed = String(value || '').trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const loadEnvFile = (filePath = path.resolve(process.cwd(), '.env')) => {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = parseValue(trimmed.slice(separator + 1));
    // Existing process variables remain authoritative for systemd/PM2/Docker.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
};

module.exports = {
  loadEnvFile,
};
