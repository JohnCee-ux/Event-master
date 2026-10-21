"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, _req, res, _next) => {
    console.error('[Unhandled Error]', err);
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        res.status(400).json({
            error: 'Validation Error',
            details: Object.values(err.errors).map((e) => e.message),
        });
        return;
    }
    // Mongoose CastError — e.g. invalid ObjectId format in a URL param
    if (err.name === 'CastError') {
        res.status(400).json({
            error: `Invalid value for field '${err.path}': ${err.value}`,
        });
        return;
    }
    // MongoDB duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
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
exports.errorHandler = errorHandler;
