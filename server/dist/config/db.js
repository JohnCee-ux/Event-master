"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDB = exports.connectDB = exports.isUsingMemoryStore = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
let mongoMemoryServer = null;
exports.isUsingMemoryStore = false;
const connectDB = async () => {
    const customUri = process.env.MONGO_URI;
    // --- TIER 1: Try user-configured MONGO_URI (e.g. Atlas cloud) ---
    if (customUri && !customUri.startsWith('#')) {
        try {
            const masked = customUri.replace(/:[^:@]+@/, ':****@');
            console.log(`Connecting to MongoDB URI: ${masked}`);
            await mongoose_1.default.connect(customUri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
            });
            console.log('✅ Connected successfully to MongoDB Atlas / Remote Database');
            return customUri;
        }
        catch (err) {
            console.warn('⚠️ Failed to connect to MONGO_URI.');
            console.warn('Reason:', err.message || err);
            console.warn('👉 If using MongoDB Atlas, make sure 0.0.0.0/0 or your current IP is added to Network Access in Atlas.');
            console.log('Falling back to local embedded MongoDB...');
        }
    }
    // --- TIER 2: Try local MongoDB (127.0.0.1:27017) ---
    try {
        const localUri = 'mongodb://127.0.0.1:27017/gatekeeper';
        await mongoose_1.default.connect(localUri, {
            serverSelectionTimeoutMS: 1500,
            connectTimeoutMS: 1500,
        });
        console.log('✅ Connected to local MongoDB instance (127.0.0.1:27017)');
        return localUri;
    }
    catch {
        // Local mongo not running, proceed to embedded MongoMemoryServer
    }
    // --- TIER 3: Spin up embedded MongoMemoryServer ---
    try {
        console.log('Initializing embedded MongoDB Memory Server...');
        mongoMemoryServer = await mongodb_memory_server_1.MongoMemoryServer.create({
            instance: { dbName: 'gatekeeper' },
        });
        const uri = mongoMemoryServer.getUri();
        await mongoose_1.default.connect(uri);
        console.log(`✅ Connected to embedded MongoMemoryServer (${uri})`);
        return uri;
    }
    catch (err) {
        console.warn('Embedded MongoDB server failed:', err.message);
        exports.isUsingMemoryStore = true;
        return 'memory://in-process-store';
    }
};
exports.connectDB = connectDB;
const closeDB = async () => {
    try {
        await mongoose_1.default.connection.close();
    }
    catch { }
    if (mongoMemoryServer) {
        try {
            await mongoMemoryServer.stop();
        }
        catch { }
    }
};
exports.closeDB = closeDB;
