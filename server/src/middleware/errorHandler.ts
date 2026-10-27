import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Unhandled Error]', err);

  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map((e: any) => e.message),
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      error: `Invalid value for field '${err.path}': ${err.value}`,
    });
    return;
  }

  // Database uniqueness violation
  if (err.code === '23505' || err.code === 11000) {
    const field = err.detail?.match(/\(([^)]+)\)/)?.[1] || Object.keys(err.keyValue || {})[0] || 'field';
    res.status(409).json({
      error: `A record with this ${field} already exists.`,
    });
    return;
  }

  // JWT errors — return 401 instead of 500
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid authentication token.' });
    return;
  }
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Authentication token has expired. Please log in again.' });
    return;
  }

  // Malformed JSON body (SyntaxError from express.json())
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON in request body.' });
    return;
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
};
