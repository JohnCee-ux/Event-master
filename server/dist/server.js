"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_dns_1 = __importDefault(require("node:dns"));
node_dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const db_js_1 = require("./config/db.js");
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const eventRoutes_js_1 = __importDefault(require("./routes/eventRoutes.js"));
const attendeeRoutes_js_1 = __importDefault(require("./routes/attendeeRoutes.js"));
const checkinRoutes_js_1 = __importDefault(require("./routes/checkinRoutes.js"));
const superAdminRoutes_js_1 = __importDefault(require("./routes/superAdminRoutes.js"));
const errorHandler_js_1 = require("./middleware/errorHandler.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// CORS configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    process.env.CLIENT_URL,
].filter(Boolean);
// Security headers — helmet must come before CORS so it can set the right headers
app.use((0, helmet_1.default)({
    // Relax CSP so the API doesn't block legitimate browser requests
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", ...allowedOrigins],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // keep false — needed for QR image blobs
}));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl) or if in allowedOrigins
        if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            callback(null, true);
        }
        else {
            callback(new Error('Origin not allowed by CORS policy'));
        }
    },
    credentials: true,
}));
// HTTP request logger
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express_1.default.json({ limit: '5mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '5mb' }));
app.use((0, cookie_parser_1.default)());
// API Health Check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'GateKeeper Event Check-In API',
    });
});
// API Routes
app.use('/api/auth', authRoutes_js_1.default);
app.use('/api/events', eventRoutes_js_1.default);
app.use('/api/attendees', attendeeRoutes_js_1.default);
app.use('/api/checkins', checkinRoutes_js_1.default);
app.use('/api/super-admin', superAdminRoutes_js_1.default);
// Error Handling Middleware
app.use(errorHandler_js_1.errorHandler);
// Server startup
let serverInstance = null;
const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
            throw new Error('JWT_SECRET must be configured with at least 32 characters.');
        }
        await (0, db_js_1.connectDB)();
        serverInstance = app.listen(PORT, () => {
            console.log(`=========================================`);
            console.log(` GateKeeper API running on port ${PORT}`);
            console.log(` http://localhost:${PORT}`);
            console.log(` Health Check: http://localhost:${PORT}/api/health`);
            console.log(`=========================================`);
        });
    }
    catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};
const handleShutdown = async () => {
    console.log('\nShutting down server gracefully...');
    if (serverInstance) {
        serverInstance.close();
    }
    await (0, db_js_1.closeDB)();
    process.exit(0);
};
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
startServer();
exports.default = app;
