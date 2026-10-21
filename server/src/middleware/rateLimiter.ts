import rateLimit from 'express-rate-limit';

export const publicRegisterLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 registration requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many registration requests from this IP. Please try again in a minute.',
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

export const publicLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many ticket lookup attempts. Please try again later.' },
});
