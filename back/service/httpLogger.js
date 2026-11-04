const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MAX_LOG_LENGTH = 1200;
const LOG_DIR = process.env.EXTERNAL_LOG_DIR || path.resolve(__dirname, '../logs');
const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'secret',
  'client_secret',
  'private_key',
  'privatekey',
  'pem',
  'key',
  'signature',
  'access_token',
  'refresh_token',
]);

const redact = (value, key = '') => {
  if (SENSITIVE_KEYS.has(String(key).toLowerCase())) return '[REDACTED]';
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (value instanceof Uint8Array) return `[Binary ${value.byteLength} bytes]`;
  if (value && typeof value.getHeaders === 'function') return '[FormData]';
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item));
  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).slice(0, 50).forEach(([childKey, childValue]) => {
      output[childKey] = redact(childValue, childKey);
    });
    return output;
  }
  return String(value);
};

const preview = (value) => {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_LOG_LENGTH ? `${value.slice(0, MAX_LOG_LENGTH)}...[truncated]` : value;
  }
  try {
    const text = JSON.stringify(redact(value));
    return text.length > MAX_LOG_LENGTH ? `${text.slice(0, MAX_LOG_LENGTH)}...[truncated]` : redact(value);
  } catch (_error) {
    return `[unserializable ${typeof value}]`;
  }
};

const requestSummary = (options = {}) => ({
  method: String(options.method || 'GET').toUpperCase(),
  url: String(options.url || ''),
  body: preview(options.body),
});

const log = (event, details = {}) => {
  const entry = {
    time: new Date().toISOString(),
    ...details,
  };

  // Keep terminal output for live debugging and append the same structured
  // entry to a daily file for later troubleshooting.
  console.log(`[external][${event}]`, entry);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const date = entry.time.slice(0, 10);
    const line = JSON.stringify({ event, ...entry }) + '\n';
    fs.appendFileSync(path.join(LOG_DIR, `external-${date}.log`), line, 'utf8');
  } catch (error) {
    console.error('[external][log-write-error]', {
      directory: LOG_DIR,
      message: error?.message || String(error),
    });
  }
};

const loggedFetch = async (url, options = {}, context = '') => {
  const summary = requestSummary({ ...options, url: String(url) });
  const startedAt = Date.now();
  log('request', { context, ...summary });
  try {
    const response = await fetch(url, options);
    log('response', {
      context,
      method: summary.method,
      url: summary.url,
      status: response.status,
      ok: response.ok,
      duration_ms: Date.now() - startedAt,
    });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('json') || contentType.includes('text')) {
      response.clone().text()
        .then((body) => {
          log('response-body', {
            context,
            method: summary.method,
            url: summary.url,
            status: response.status,
            body: preview(body),
          });
        })
        .catch((error) => {
          log('response-body-error', {
            context,
            url: summary.url,
            message: error?.message || String(error),
          });
        });
    }
    return response;
  } catch (error) {
    log('error', {
      context,
      method: summary.method,
      url: summary.url,
      duration_ms: Date.now() - startedAt,
      code: error?.code || error?.cause?.code,
      message: error?.message || String(error),
    });
    throw error;
  }
};

const createLoggedAxios = (context = 'axios', options = {}) => {
  const client = axios.create(options);
  client.interceptors.request.use((config) => {
    config.metadata = { startedAt: Date.now() };
    const baseURL = String(config.baseURL || '');
    const url = new URL(String(config.url || ''), baseURL || 'http://127.0.0.1');
    log('request', {
      context,
      method: String(config.method || 'GET').toUpperCase(),
      url: url.toString(),
      body: preview(config.data),
    });
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      log('response', {
        context,
        method: String(response.config?.method || 'GET').toUpperCase(),
        url: response.config?.url || response.config?.baseURL || '',
        status: response.status,
        ok: true,
        duration_ms: Date.now() - (response.config?.metadata?.startedAt || Date.now()),
        body: preview(response.data),
      });
      return response;
    },
    (error) => {
      log('error', {
        context,
        method: String(error.config?.method || 'GET').toUpperCase(),
        url: error.config?.url || error.config?.baseURL || '',
        status: error.response?.status,
        duration_ms: Date.now() - (error.config?.metadata?.startedAt || Date.now()),
        code: error.code,
        message: error.message,
        body: preview(error.response?.data),
      });
      return Promise.reject(error);
    },
  );
  return client;
};

module.exports = {
  loggedFetch,
  createLoggedAxios,
  preview,
};
