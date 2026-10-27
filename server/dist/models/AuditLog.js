"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const supabaseModel_js_1 = require("./supabaseModel.js");
exports.AuditLog = (0, supabaseModel_js_1.createCollection)('audit_logs', {
    _id: 'id',
    eventId: 'event_id',
    attendeeId: 'attendee_id',
    organizerId: 'organizer_id',
    createdAt: 'created_at',
    attendeeName: 'attendee_name',
    ticketCode: 'ticket_code',
});
