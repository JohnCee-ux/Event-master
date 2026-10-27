"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.hasValidSuperAdminToken = exports.isConfiguredSuperAdmin = exports.getSuperAdminEmail = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware_js_1 = require("./authMiddleware.js");
const getSuperAdminEmail = () => {
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
        throw new Error('SUPER_ADMIN_EMAIL must be configured.');
    }
    return email;
};
exports.getSuperAdminEmail = getSuperAdminEmail;
const isConfiguredSuperAdmin = (email) => Boolean(email && email.trim().toLowerCase() === (0, exports.getSuperAdminEmail)());
exports.isConfiguredSuperAdmin = isConfiguredSuperAdmin;
const hasValidSuperAdminToken = (req) => {
    if (!req.organizer || !(0, exports.isConfiguredSuperAdmin)(req.organizer.email))
        return false;
    const token = req.headers['x-super-admin-token'] ||
        (req.cookies && req.cookies.superAdminToken);
    if (!token)
        return false;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, authMiddleware_js_1.getJwtSecret)());
        return Boolean(decoded.superAdminAuth &&
            decoded.id === req.organizer._id.toString() &&
            (0, exports.isConfiguredSuperAdmin)(decoded.email));
    }
    catch {
        return false;
    }
};
exports.hasValidSuperAdminToken = hasValidSuperAdminToken;
const requireSuperAdmin = async (req, res, next) => {
    try {
        if (!req.organizer) {
            res.status(401).json({ error: 'Authentication required.' });
            return;
        }
        if (!(0, exports.isConfiguredSuperAdmin)(req.organizer.email)) {
            res.status(403).json({ error: 'This account is not authorized to access Super Admin.' });
            return;
        }
        // Check for super admin token in header or cookie
        const token = req.headers['x-super-admin-token'] ||
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
        if (!(0, exports.hasValidSuperAdminToken)(req)) {
            res.status(403).json({
                error: 'Invalid or expired Super Admin session. Please re-enter your Super Admin Passcode.',
                requiresPasscode: true,
            });
            return;
        }
        req.isSuperAdmin = true;
        next();
    }
    catch (err) {
        res.status(403).json({
            error: 'Super Admin authorization expired or invalid. Please request a new OTP.',
            requiresPasscode: true,
        });
        return;
    }
};
exports.requireSuperAdmin = requireSuperAdmin;
