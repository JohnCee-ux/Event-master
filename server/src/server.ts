import dns from 'node:dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB, closeDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import attendeeRoutes from './routes/attendeeRoutes.js';
import checkinRoutes from './routes/checkinRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

// Security headers — helmet must come before CORS so it can set the right headers
app.use(
  helmet({
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
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) or if in allowedOrigins
      if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS policy'));
      }
    },
    credentials: true,
  })
);

// HTTP request logger
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// API Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'GateKeeper Event Check-In API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendees', attendeeRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/super-admin', superAdminRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Server startup
let serverInstance: any = null;

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    if (!process.env.SUPER_ADMIN_EMAIL?.trim()) {
      throw new Error('SUPER_ADMIN_EMAIL must be configured.');
    }
    if (!process.env.SMTP_USER?.trim() || !process.env.SMTP_PASS?.trim()) {
      throw new Error('SMTP_USER and SMTP_PASS must be configured for email delivery.');
    }
    await connectDB();
    serverInstance = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`=========================================`);
      console.log(` GateKeeper API running on port ${PORT}`);
      console.log(` http://localhost:${PORT}`);
      console.log(` Health Check: http://localhost:${PORT}/api/health`);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

const handleShutdown = async () => {
  console.log('\nShutting down server gracefully...');
  if (serverInstance) {
    serverInstance.close();
  }
  await closeDB();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

startServer();

export default app;
