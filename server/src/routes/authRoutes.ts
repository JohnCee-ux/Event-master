import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Organizer } from '../models/Organizer.js';
import { authMiddleware, AuthenticatedRequest, getJwtSecret } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { sendOtpEmail } from '../services/emailService.js';

const router = Router();

// In-memory OTP storage: email -> { otp, expiresAt, attempts }
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
const passwordResetStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const setAuthCookie = (res: Response, token: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  });
};

// ── Send Email OTP ─────────────────────────────────────────────────────────────
router.post('/send-otp', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = sendOtpSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();

    // Check if recent active OTP exists to throttle rapid spam
    const existing = otpStore.get(normalizedEmail);
    const now = Date.now();
    if (existing && existing.expiresAt - now > 8.5 * 60 * 1000) {
      res.status(429).json({
        error: 'Please wait 90 seconds before requesting another verification code.',
      });
      return;
    }

    // Generate cryptographically random 6-digit number
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

    otpStore.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

    const emailResult = await sendOtpEmail(normalizedEmail, otp);

    res.json({
      success: true,
      message: `Authentication code sent to ${normalizedEmail}`,
      previewUrl: emailResult.previewUrl,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error('Send OTP error:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification code.' });
  }
});

// ── Send Password Reset OTP ──────────────────────────────────────────────────
router.post('/send-password-reset-otp', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = sendOtpSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();
    const now = Date.now();
    const existing = passwordResetStore.get(normalizedEmail);

    if (existing && existing.expiresAt - now > 8.5 * 60 * 1000) {
      res.status(429).json({
        error: 'Please wait 90 seconds before requesting another verification code.',
      });
      return;
    }

    const organizer = await Organizer.findOne({ email: normalizedEmail });
    if (organizer) {
      const otp = crypto.randomInt(100000, 1000000).toString();
      passwordResetStore.set(normalizedEmail, {
        otp,
        expiresAt: now + 10 * 60 * 1000,
        attempts: 0,
      });
      const emailResult = await sendOtpEmail(normalizedEmail, otp, 'password-reset');
      if (!emailResult.success) {
        passwordResetStore.delete(normalizedEmail);
        res.status(502).json({ error: 'Unable to send the password reset email. Please try again.' });
        return;
      }
    }

    res.json({
      success: true,
      message: 'If an account exists for that email, a password reset code has been sent.',
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error('Send password reset OTP error:', err);
    res.status(500).json({ error: 'Unable to send password reset code.' });
  }
});

// ── Verify Password Reset OTP and Set New Password ────────────────────────────
router.post('/reset-password', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = resetPasswordSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();
    const record = passwordResetStore.get(normalizedEmail);

    if (!record) {
      res.status(400).json({ error: 'No active password reset code found. Please request a new one.' });
      return;
    }
    if (Date.now() > record.expiresAt) {
      passwordResetStore.delete(normalizedEmail);
      res.status(400).json({ error: 'Password reset code has expired. Please request a new one.' });
      return;
    }
    if (record.attempts >= 5) {
      passwordResetStore.delete(normalizedEmail);
      res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
      return;
    }
    if (record.otp !== validated.otp.trim()) {
      record.attempts += 1;
      res.status(400).json({ error: 'Invalid password reset code.' });
      return;
    }

    const organizer = await Organizer.findOne({ email: normalizedEmail });
    passwordResetStore.delete(normalizedEmail);
    if (!organizer) {
      res.status(400).json({ error: 'Unable to reset password. Please request a new code.' });
      return;
    }

    organizer.passwordHash = await bcrypt.hash(validated.password, await bcrypt.genSalt(10));
    await organizer.save();
    res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});


// ── Verify Email OTP & Login / Auto-Register ───────────────────────────────────
router.post('/verify-otp', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = verifyOtpSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();
    const enteredOtp = validated.otp.trim();

    const record = otpStore.get(normalizedEmail);
    if (!record) {
      res.status(400).json({ error: 'No active OTP found. Please request a new verification code.' });
      return;
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      return;
    }

    if (record.attempts >= 5) {
      otpStore.delete(normalizedEmail);
      res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
      return;
    }

    if (record.otp !== enteredOtp) {
      record.attempts += 1;
      res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
      return;
    }

    // OTP verified successfully! Clear OTP
    otpStore.delete(normalizedEmail);

    // Look for existing organizer or auto-provision
    let organizer = await Organizer.findOne({ email: normalizedEmail });
    if (!organizer) {
      const defaultName = normalizedEmail.split('@')[0].replace(/[._-]/g, ' ');
      const capitalizedName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(`otp_auth_${Date.now()}`, salt);

      organizer = await Organizer.create({
        name: capitalizedName || 'Organizer',
        email: normalizedEmail,
        passwordHash,
      });
    }

    const token = jwt.sign(
      { id: organizer._id.toString(), email: organizer.email },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    setAuthCookie(res, token);

    res.json({
      token,
      organizer: {
        id: organizer._id.toString(),
        name: organizer.name,
        email: organizer.email,
        role: organizer.role || 'organizer',
        createdAt: organizer.createdAt,
        updatedAt: organizer.updatedAt,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: err.message || 'OTP verification failed.' });
  }
});

// Register Organizer
router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = registerSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();

    const existing = await Organizer.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    const organizer = await Organizer.create({
      name: validated.name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    const token = jwt.sign(
      { id: organizer._id.toString(), email: organizer.email },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    setAuthCookie(res, token);

    res.status(201).json({
      token,
      organizer: {
        id: organizer._id.toString(),
        name: organizer.name,
        email: organizer.email,
        role: organizer.role || 'organizer',
        createdAt: organizer.createdAt,
        updatedAt: organizer.updatedAt,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// Login Organizer
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();

    const organizer = await Organizer.findOne({ email: normalizedEmail });
    if (!organizer) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(validated.password, organizer.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { id: organizer._id.toString(), email: organizer.email },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    setAuthCookie(res, token);

    res.json({
      token,
      organizer: {
        id: organizer._id.toString(),
        name: organizer.name,
        email: organizer.email,
        role: organizer.role || 'organizer',
        createdAt: organizer.createdAt,
        updatedAt: organizer.updatedAt,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// Logout Organizer
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get Current Logged-in Organizer
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const organizer = req.organizer!;
  res.json({
    organizer: {
      id: organizer._id.toString(),
      name: organizer.name,
      email: organizer.email,
      role: organizer.role || 'organizer',
      createdAt: organizer.createdAt,
      updatedAt: organizer.updatedAt,
    },
  });
});

export default router;
