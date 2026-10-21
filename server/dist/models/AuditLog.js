"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const db_js_1 = require("../config/db.js");
const memoryDb_js_1 = require("../config/memoryDb.js");
const AuditLogSchema = new mongoose_1.Schema({
    eventId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    attendeeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Attendee', default: null, index: true },
    organizerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organizer', default: null },
    action: {
        type: String,
        required: true,
        enum: [
            'CREATE_EVENT',
            'UPDATE_EVENT',
            'PUBLISH_EVENT',
            'START_EVENT',
            'END_EVENT',
            'REGISTER_ATTENDEE',
            'CHECK_IN',
            'DUPLICATE_CHECK_IN',
            'INVALID_CHECK_IN',
            'UNDO_CHECK_IN',
            'RESEND_TICKET',
            'OFFLINE_SCAN_QUEUED',
            'OFFLINE_SCAN_SYNCED',
            'OFFLINE_SCAN_REJECTED',
        ],
        index: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    attendeeName: { type: String, default: '' },
    ticketCode: { type: String, default: '' },
}, { timestamps: false, versionKey: false });
AuditLogSchema.index({ eventId: 1, timestamp: -1 });
const MongooseAuditLog = mongoose_1.default.model('AuditLog', AuditLogSchema);
exports.AuditLog = {
    findOne: (query) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.auditLogs.findOne(query) : MongooseAuditLog.findOne(query)),
    findById: (id) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.auditLogs.findById(id) : MongooseAuditLog.findById(id)),
    create: (data) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.auditLogs.create(data) : MongooseAuditLog.create(data)),
    find: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.auditLogs.find(query) : MongooseAuditLog.find(query)),
    countDocuments: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.auditLogs.countDocuments(query) : MongooseAuditLog.countDocuments(query)),
    deleteMany: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.auditLogs.deleteMany(query) : MongooseAuditLog.deleteMany(query)),
};
