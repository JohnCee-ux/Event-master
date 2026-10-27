"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Organizer = void 0;
const supabaseModel_js_1 = require("./supabaseModel.js");
exports.Organizer = (0, supabaseModel_js_1.createCollection)('organizers', {
    _id: 'id',
    passwordHash: 'password_hash',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
