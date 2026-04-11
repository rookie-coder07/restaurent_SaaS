const logger = {
  info: (msg, data) => {
    if (import.meta.env.DEV) {
      console.log('[INFO]', msg, data);
    }
  },
  debug: (msg, data) => {
    if (import.meta.env.DEV) {
      console.log('[DEBUG]', msg, data);
    }
  },
  warn: (msg, data) => {
    if (import.meta.env.DEV) {
      console.warn('[WARN]', msg, data);
    }
  },
  error: (msg, err) => {
    if (import.meta.env.DEV) {
      console.error('[ERROR]', msg, err);
    }
  },
};

export default logger;
