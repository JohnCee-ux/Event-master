import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, AuthenticatedRequest } from './authMiddleware.js';

export interface SuperAdminRequest extends AuthenticatedRequest {
  isSuperAdmin?: boolean;
}

export const getSuperAdminPasscode = (): string => {
  return process.env.SUPER_ADMIN_PASSWORD || 'GateKeeper#SuperAdmin2026!';
};

export const requireSuperAdmin = async (
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.organizer) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    // Check for super admin token in header or cookie
    const token =
      (req.headers['x-super-admin-token'] as string) ||
      (req.cookies && req.cookies.superAdminToken);

    if (!token) {
      // If user account is marked as superadmin and passkey is not set in header,
      // require entering the unique super admin password
      res.status(403).json({
        error: 'Super Admin access locked. Please enter your Super Admin Security Passcode to unlock.',
        requiresPasscode: true,
      });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      role: string;
      superAdminAuth: boolean;
    };

    if (
      !decoded ||
      !decoded.superAdminAuth ||
      decoded.id !== req.organizer._id.toString()
    ) {
      res.status(403).json({
        error: 'Invalid or expired Super Admin session. Please re-enter your Super Admin Passcode.',
        requiresPasscode: true,
      });
      return;
    }

    req.isSuperAdmin = true;
    next();
  } catch (err: any) {
    res.status(403).json({
      error: 'Super Admin authorization expired or invalid. Please re-enter your passcode.',
      requiresPasscode: true,
    });
    return;
  }
};
