"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attendee = void 0;
const supabaseModel_js_1 = require("./supabaseModel.js");
const supabase_js_1 = require("../config/supabase.js");
const collection = (0, supabaseModel_js_1.createCollection)('attendees', {
    _id: 'id',
    eventId: 'event_id',
    ticketType: 'ticket_type',
    ticketCode: 'ticket_code',
    qrToken: 'qr_token',
    registeredAt: 'registered_at',
    checkedInAt: 'checked_in_at',
    checkedInBy: 'checked_in_by',
    emailSent: 'email_sent',
    emailLastAttemptAt: 'email_last_attempt_at',
    offlineScanIds: 'offline_scan_ids',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
exports.Attendee = {
    ...collection,
    findOneAndUpdate: async (query, update) => {
        if (update?.$set?.checkedInAt && update?.$addToSet?.offlineScanIds && query?._id) {
            const { data, error } = await supabase_js_1.supabase.rpc('claim_attendee_checkin', {
                p_attendee_id: query._id.toString(),
                p_checked_in_at: update.$set.checkedInAt,
                p_checked_in_by: update.$set.checkedInBy || null,
                p_scan_id: update.$addToSet.offlineScanIds,
            });
            if (error)
                throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row)
                return null;
            return collection.findById(row.id);
        }
        return collection.findOneAndUpdate(query, update);
    },
};
