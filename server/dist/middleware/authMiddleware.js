"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.getJwtSecret = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Organizer_js_1 = require("../models/Organizer.js");
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret || secret.length < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    return secret;
};
exports.getJwtSecret = getJwtSecret;
const authMiddleware = async (req, res, next) => {
    try {
        let token;
        // Check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        else if (req.cookies && req.cookies.token) {
            // Check httpOnly cookie
            token = req.cookies.token;
        }
        if (!token) {
            res.status(401).json({ error: 'Authentication required. No valid token found.' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, (0, exports.getJwtSecret)());
        const organizer = await Organizer_js_1.Organizer.findById(decoded.id);
        if (!organizer) {
            res.status(401).json({ error: 'Organizer account not found.' });
            return;
        }
        req.organizer = organizer;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid or expired authentication token.' });
        return;
    }
};
exports.authMiddleware = authMiddleware;
