"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const Organizer_js_1 = require("../models/Organizer.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const emailService_js_1 = require("../services/emailService.js");
const otpRateLimiter_js_1 = require("../services/otpRateLimiter.js");
const router = (0, express_1.Router)();
// In-memory OTP storage: email -> { otp, expiresAt, attempts }
const otpStore = new Map();
const passwordResetStore = new Map();
const registrationStore = new Map();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const sendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
const verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
});
const resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
const registrationOtpSchema = registerSchema;
const verifyRegistrationSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
});
const setAuthCookie = (res, token) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });
};
const clearAuthCookies = (res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/',
    };
    res.clearCookie('token', cookieOptions);
    res.clearCookie('superAdminToken', cookieOptions);
};
// ── Send Email OTP ─────────────────────────────────────────────────────────────
router.post('/send-otp', rateLimiter_js_1.authLimiter, async (req, res) => {
    try {
        const validated = sendOtpSchema.parse(req.body);
        const normalizedEmail = validated.email.toLowerCase().trim();
        const now = Date.now();
        const quota = (0, otpRateLimiter_js_1.consumeOtpRequest)(normalizedEmail);
        if (!quota.allowed) {
            res.status(429).json({
                error: `Too many OTP requests. Try again in ${Math.ceil(quota.retryAfterSeconds / 60)} minutes.`,
            });
            return;
        }
        // Generate cryptographically random 6-digit number
        const otp = crypto_1.default.randomInt(100000, 1000000).toString();
        const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry
        otpStore.set(normalizedEmail, { otp, expiresAt, attempts: 0 });
        const emailResult = await (0, emailService_js_1.sendOtpEmail)(normalizedEmail, otp);
        if (!emailResult.success) {
            otpStore.delete(normalizedEmail);
            res.status(502).json({ error: 'Unable to send the verification code. Please try again.' });
            return;
        }
        res.json({
            success: true,
            message: `Authentication code sent to ${normalizedEmail}`,
            previewUrl: emailResult.previewUrl,
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        console.error('Send OTP error:', err);
        res.status(500).json({ error: err.message || 'Failed to send verification code.' });
    }
});
// ── Organizer registration OTP ───────────────────────────────────────────────
router.post('/register/request-otp', rateLimiter_js_1.authLimiter, async (req, res) => {
    try {
        const validated = registrationOtpSchema.parse(req.body);
        const email = validated.email.toLowerCase().trim();
        const existing = await Organizer_js_1.Organizer.findOne({ email });
        if (existing) {
            res.status(409).json({
                error: 'An account already exists for this email. Please log in instead.',
                code: 'ACCOUNT_EXISTS',
            });
            return;
        }
        const quota = (0, otpRateLimiter_js_1.consumeOtpRequest)(email);
        if (!quota.allowed) {
            res.status(429).json({ error: `Too many OTP requests. Try again in ${Math.ceil(quota.retryAfterSeconds / 60)} minutes.` });
            return;
        }
        const otp = crypto_1.default.randomInt(100000, 1000000).toString();
        const passwordHash = await bcryptjs_1.default.hash(validated.password, await bcryptjs_1.default.genSalt(10));
        registrationStore.set(email, {
            name: validated.name.trim(),
            passwordHash,
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
        });
        const emailResult = await (0, emailService_js_1.sendOtpEmail)(email, otp, 'registration');
        if (!emailResult.success) {
            registrationStore.delete(email);
            res.status(502).json({ error: 'Unable to send the registration code. Please try again.' });
            return;
        }
        res.json({ success: true, message: `A verification code was sent to ${email}.` });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        console.error('Request registration OTP error:', err);
        res.status(500).json({ error: 'Unable to send the registration code.' });
    }
});
router.post('/register/verify-otp', rateLimiter_js_1.authLimiter, async (req, res) => {
    try {
        const validated = verifyRegistrationSchema.parse(req.body);
        const email = validated.email.toLowerCase().trim();
        const record = registrationStore.get(email);
        if (!record) {
            res.status(400).json({ error: 'No active registration code found. Please request a new one.' });
            return;
        }
        if (Date.now() > record.expiresAt) {
            registrationStore.delete(email);
            res.status(400).json({ error: 'Registration code expired. Please request a new one.' });
            return;
        }
        if (record.attempts >= 5) {
            registrationStore.delete(email);
            res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
            return;
        }
        if (record.otp !== validated.otp.trim()) {
            record.attempts += 1;
            res.status(400).json({ error: 'Invalid registration code.' });
            return;
        }
        const existing = await Organizer_js_1.Organizer.findOne({ email });
        if (existing) {
            registrationStore.delete(email);
            res.status(409).json({ error: 'An account already exists for this email. Please log in instead.', code: 'ACCOUNT_EXISTS' });
            return;
        }
        const organizer = await Organizer_js_1.Organizer.create({ name: record.name, email, passwordHash: record.passwordHash });
        registrationStore.delete(email);
        const token = jsonwebtoken_1.default.sign({ id: organizer._id.toString(), email: organizer.email }, (0, authMiddleware_js_1.getJwtSecret)(), { expiresIn: '8h' });
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        console.error('Verify registration OTP error:', err);
        res.status(500).json({ error: 'Registration verification failed.' });
    }
});
// ── Send Password Reset OTP ──────────────────────────────────────────────────
router.post('/send-password-reset-otp', rateLimiter_js_1.authLimiter, async (req, res) => {
    try {
        const validated = sendOtpSchema.parse(req.body);
        const normalizedEmail = validated.email.toLowerCase().trim();
        const now = Date.now();
        const quota = (0, otpRateLimiter_js_1.consumeOtpRequest)(normalizedEmail);
        if (!quota.allowed) {
            res.status(429).json({
                error: `Too many OTP requests. Try again in ${Math.ceil(quota.retryAfterSeconds / 60)} minutes.`,
            });
            return;
        }
        const organizer = await Organizer_js_1.Organizer.findOne({ email: normalizedEmail });
        if (organizer) {
            const otp = crypto_1.default.randomInt(100000, 1000000).toString();
            passwordResetStore.set(normalizedEmail, {
                otp,
                expiresAt: now + 10 * 60 * 1000,
                attempts: 0,
            });
            const emailResult = await (0, emailService_js_1.sendOtpEmail)(normalizedEmail, otp, 'password-reset');
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        console.error('Send password reset OTP error:', err);
        res.status(500).json({ error: 'Unable to send password reset code.' });
    }
});
// ── Verify Password Reset OTP and Set New Password ────────────────────────────
router.post('/reset-password', rateLimiter_js_1.authLimiter, async (req, res) => {
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
        const organizer = await Organizer_js_1.Organizer.findOne({ email: normalizedEmail });
        passwordResetStore.delete(normalizedEmail);
        if (!organizer) {
            res.status(400).json({ error: 'Unable to reset password. Please request a new code.' });
            return;
        }
        organizer.passwordHash = await bcryptjs_1.default.hash(validated.password, await bcryptjs_1.default.genSalt(10));
        await organizer.save();
        res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Password reset failed.' });
    }
});
// ── Verify Email OTP & Login / Auto-Register ───────────────────────────────────
router.post('/verify-otp', rateLimiter_js_1.authLimiter, async (req, res) => {
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
        let organizer = await Organizer_js_1.Organizer.findOne({ email: normalizedEmail });
        if (!organizer) {
            const defaultName = normalizedEmail.split('@')[0].replace(/[._-]/g, ' ');
            const capitalizedName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash(`otp_auth_${Date.now()}`, salt);
            organizer = await Organizer_js_1.Organizer.create({
                name: capitalizedName || 'Organizer',
                email: normalizedEmail,
                passwordHash,
            });
        }
        const token = jsonwebtoken_1.default.sign({ id: organizer._id.toString(), email: organizer.email }, (0, authMiddleware_js_1.getJwtSecret)(), { expiresIn: '8h' });
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: err.message || 'OTP verification failed.' });
    }
});
// Register Organizer
router.post('/register', rateLimiter_js_1.authLimiter, async (req, res) => {
    res.status(428).json({
        error: 'Email verification is required. Request an OTP before completing registration.',
    });
});
// Login Organizer
router.post('/login', rateLimiter_js_1.authLimiter, async (req, res) => {
    try {
        const validated = loginSchema.parse(req.body);
        const normalizedEmail = validated.email.toLowerCase().trim();
        const organizer = await Organizer_js_1.Organizer.findOne({ email: normalizedEmail });
        if (!organizer) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(validated.password, organizer.passwordHash);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: organizer._id.toString(), email: organizer.email }, (0, authMiddleware_js_1.getJwtSecret)(), { expiresIn: '8h' });
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        res.status(500).json({ error: err.message || 'Login failed.' });
    }
});
// Logout Organizer
router.post('/logout', (_req, res) => {
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
});
// Get Current Logged-in Organizer
router.get('/me', authMiddleware_js_1.authMiddleware, async (req, res) => {
    const organizer = req.organizer;
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
exports.default = router;
