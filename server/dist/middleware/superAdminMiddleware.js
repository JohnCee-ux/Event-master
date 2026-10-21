"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.getSuperAdminPasscode = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware_js_1 = require("./authMiddleware.js");
const getSuperAdminPasscode = () => {
    return process.env.SUPER_ADMIN_PASSWORD || 'GateKeeper#SuperAdmin2026!';
};
exports.getSuperAdminPasscode = getSuperAdminPasscode;
const requireSuperAdmin = async (req, res, next) => {
    try {
        if (!req.organizer) {
            res.status(401).json({ error: 'Authentication required.' });
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
        const decoded = jsonwebtoken_1.default.verify(token, (0, authMiddleware_js_1.getJwtSecret)());
        if (!decoded ||
            !decoded.superAdminAuth ||
            decoded.id !== req.organizer._id.toString()) {
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
            error: 'Super Admin authorization expired or invalid. Please re-enter your passcode.',
            requiresPasscode: true,
        });
        return;
    }
};
exports.requireSuperAdmin = requireSuperAdmin;
