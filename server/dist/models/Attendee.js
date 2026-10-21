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
exports.Attendee = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const db_js_1 = require("../config/db.js");
const memoryDb_js_1 = require("../config/memoryDb.js");
const AttendeeSchema = new mongoose_1.Schema({
    eventId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    ticketType: { type: String, default: 'General', trim: true },
    ticketCode: { type: String, required: true, trim: true },
    qrToken: { type: String, required: true, trim: true, index: true },
    registeredAt: { type: Date, default: Date.now },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: null },
    emailSent: { type: Boolean, default: false },
    emailLastAttemptAt: { type: Date, default: null },
    offlineScanIds: { type: [String], default: [] },
}, { timestamps: true });
AttendeeSchema.index({ eventId: 1, email: 1 }, { unique: true });
AttendeeSchema.index({ eventId: 1, ticketCode: 1 }, { unique: true });
AttendeeSchema.index({ eventId: 1, checkedInAt: 1 });
AttendeeSchema.index({ eventId: 1, qrToken: 1 });
const MongooseAttendee = mongoose_1.default.model('Attendee', AttendeeSchema);
exports.Attendee = {
    findOne: (query) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.findOne(query) : MongooseAttendee.findOne(query)),
    findOneAndUpdate: (query, update) => (db_js_1.isUsingMemoryStore
        ? memoryDb_js_1.memoryStore.attendees.findOneAndUpdate(query, update)
        : MongooseAttendee.findOneAndUpdate(query, update, { new: true })),
    findById: (id) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.findById(id) : MongooseAttendee.findById(id)),
    create: (data) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.create(data) : MongooseAttendee.create(data)),
    find: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.find(query) : MongooseAttendee.find(query)),
    countDocuments: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.countDocuments(query) : MongooseAttendee.countDocuments(query)),
    aggregate: (pipeline) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.aggregate(pipeline) : MongooseAttendee.aggregate(pipeline)),
    deleteMany: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.deleteMany(query) : MongooseAttendee.deleteMany(query)),
    findByIdAndDelete: (id) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.attendees.findByIdAndDelete(id) : MongooseAttendee.findByIdAndDelete(id)),
};
