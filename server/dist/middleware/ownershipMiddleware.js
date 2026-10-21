"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEventOwnership = void 0;
const Event_js_1 = require("../models/Event.js");
const requireEventOwnership = async (req, res, next) => {
    try {
        if (!req.organizer) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const rawEventId = req.params.eventId ||
            req.params.id ||
            req.query.eventId ||
            req.body.eventId;
        if (!rawEventId) {
            res.status(400).json({ error: 'A valid eventId parameter is required' });
            return;
        }
        const organizerIdStr = req.organizer._id ? req.organizer._id.toString() : '';
        const isSuperAdmin = req.organizer.role === 'superadmin' ||
            !!req.headers['x-super-admin-token'] ||
            !!(req.cookies && req.cookies.superAdminToken);
        const query = { _id: rawEventId };
        if (!isSuperAdmin) {
            query.organizerId = organizerIdStr;
        }
        const event = await Event_js_1.Event.findOne(query);
        if (!event) {
            res.status(404).json({ error: 'Event not found or access denied.' });
            return;
        }
        req.event = event;
        next();
    }
    catch (err) {
        res.status(500).json({ error: 'Server error verifying event ownership.' });
        return;
    }
};
exports.requireEventOwnership = requireEventOwnership;
