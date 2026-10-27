"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Event = void 0;
const supabaseModel_js_1 = require("./supabaseModel.js");
const supabase_js_1 = require("../config/supabase.js");
const collection = (0, supabaseModel_js_1.createCollection)('events', {
    _id: 'id',
    imageDataUrl: 'image_data_url',
    startTime: 'start_time',
    registeredCount: 'registered_count',
    organizerId: 'organizer_id',
    startedAt: 'started_at',
    endedAt: 'ended_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
exports.Event = {
    ...collection,
    findOneAndUpdate: async (query, update) => {
        if (update?.$inc?.registeredCount === 1 && query?._id && query?.$or) {
            const { data, error } = await supabase_js_1.supabase.rpc('reserve_event_capacity', { p_event_id: query._id.toString() });
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
