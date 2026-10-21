import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Organizer, IOrganizerDocument } from '../models/Organizer.js';

export interface AuthenticatedRequest extends Request {
  organizer?: IOrganizerDocument;
}

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  return secret;
};

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Check httpOnly cookie
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. No valid token found.' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as { id: string; email: string };
    const organizer = await Organizer.findById(decoded.id);

    if (!organizer) {
      res.status(401).json({ error: 'Organizer account not found.' });
      return;
    }

    req.organizer = organizer;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
    return;
  }
};
