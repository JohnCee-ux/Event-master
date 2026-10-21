"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicLookupLimiter = exports.authLimiter = exports.publicRegisterLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.publicRegisterLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 registration requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many registration requests from this IP. Please try again in a minute.',
    },
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again later.' },
});
exports.publicLookupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many ticket lookup attempts. Please try again later.' },
});
