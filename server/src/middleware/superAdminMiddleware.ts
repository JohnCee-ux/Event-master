import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, AuthenticatedRequest } from './authMiddleware.js';

export interface SuperAdminRequest extends AuthenticatedRequest {
  isSuperAdmin?: boolean;
}

export const getSuperAdminEmail = (): string => {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error('SUPER_ADMIN_EMAIL must be configured.');
  }
  return email;
};

export const isConfiguredSuperAdmin = (email: string | undefined): boolean =>
  Boolean(email && email.trim().toLowerCase() === getSuperAdminEmail());

export const hasValidSuperAdminToken = (req: AuthenticatedRequest): boolean => {
  if (!req.organizer || !isConfiguredSuperAdmin(req.organizer.email)) return false;

  const token =
    (req.headers['x-super-admin-token'] as string) ||
    (req.cookies && req.cookies.superAdminToken);
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      superAdminAuth: boolean;
    };
    return Boolean(
      decoded.superAdminAuth &&
        decoded.id === req.organizer._id.toString() &&
        isConfiguredSuperAdmin(decoded.email)
    );
  } catch {
    return false;
  }
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

    if (!isConfiguredSuperAdmin(req.organizer.email)) {
      res.status(403).json({ error: 'This account is not authorized to access Super Admin.' });
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

    if (!hasValidSuperAdminToken(req)) {
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
      error: 'Super Admin authorization expired or invalid. Please request a new OTP.',
      requiresPasscode: true,
    });
    return;
  }
};
