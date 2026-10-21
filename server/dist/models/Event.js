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
exports.Event = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const db_js_1 = require("../config/db.js");
const memoryDb_js_1 = require("../config/memoryDb.js");
const EventSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    imageDataUrl: { type: String, default: null },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, default: 100 },
    registeredCount: { type: Number, required: true, min: 0, default: 0 },
    status: {
        type: String,
        enum: ['DRAFT', 'UPCOMING', 'LIVE', 'ENDED'],
        default: 'DRAFT',
        required: true,
        index: true,
    },
    prefix: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        minlength: 2,
        maxlength: 8,
        default: 'EVT',
    },
    organizerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organizer', required: true, index: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
}, { timestamps: true });
const MongooseEvent = mongoose_1.default.model('Event', EventSchema);
exports.Event = {
    findOne: (query) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.events.findOne(query) : MongooseEvent.findOne(query)),
    findOneAndUpdate: (query, update) => (db_js_1.isUsingMemoryStore
        ? memoryDb_js_1.memoryStore.events.findOneAndUpdate(query, update)
        : MongooseEvent.findOneAndUpdate(query, update, { new: true })),
    findById: (id) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.events.findById(id) : MongooseEvent.findById(id)),
    create: (data) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.events.create(data) : MongooseEvent.create(data)),
    find: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.events.find(query) : MongooseEvent.find(query)),
    countDocuments: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.events.countDocuments(query) : MongooseEvent.countDocuments(query)),
    findByIdAndDelete: (id) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.events.findByIdAndDelete(id) : MongooseEvent.findByIdAndDelete(id)),
    deleteMany: (query = {}) => (db_js_1.isUsingMemoryStore ? memoryDb_js_1.memoryStore.events.deleteMany(query) : MongooseEvent.deleteMany(query)),
};
