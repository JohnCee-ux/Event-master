"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const Event_js_1 = require("../models/Event.js");
const Attendee_js_1 = require("../models/Attendee.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const ownershipMiddleware_js_1 = require("../middleware/ownershipMiddleware.js");
const auditService_js_1 = require("../services/auditService.js");
const router = (0, express_1.Router)();
const eventImageSchema = zod_1.z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+=*$/, 'Event graphic must be a valid image.')
    .max(4 * 1024 * 1024, 'Event graphic must be 3 MB or smaller.')
    .nullable()
    .optional();
const createEventSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, 'Event name must be at least 3 characters'),
    description: zod_1.z.string().optional().default(''),
    imageDataUrl: eventImageSchema,
    date: zod_1.z.string().min(1, 'Date is required'),
    startTime: zod_1.z.string().min(1, 'Start time is required'),
    venue: zod_1.z.string().min(2, 'Venue is required'),
    capacity: zod_1.z.number().int().min(1, 'Capacity must be at least 1').default(100),
    prefix: zod_1.z.string().min(2).max(8).optional().default('EVT'),
});
const updateEventSchema = createEventSchema.partial();
const getAttendeeCounts = async (eventIds) => {
    const attendees = await Attendee_js_1.Attendee.find({ eventId: { $in: eventIds } }).exec();
    const countMap = new Map();
    attendees.forEach((attendee) => {
        const eventId = attendee.eventId.toString();
        const current = countMap.get(eventId) || { registeredCount: 0, checkedInCount: 0 };
        current.registeredCount += 1;
        if (attendee.checkedInAt)
            current.checkedInCount += 1;
        countMap.set(eventId, current);
    });
    return countMap;
};
// List organizer's events with real-time registered and checkedIn counts
router.get('/', authMiddleware_js_1.authMiddleware, async (req, res) => {
    try {
        const organizerId = req.organizer._id.toString();
        const events = await Event_js_1.Event.find({ organizerId }).sort({ createdAt: -1 }).lean();
        const eventIds = events.map((e) => e._id);
        const countMap = await getAttendeeCounts(eventIds);
        const enriched = events.map((evt) => {
            const c = countMap.get(evt._id.toString()) || { registeredCount: 0, checkedInCount: 0 };
            return {
                id: evt._id.toString(),
                name: evt.name,
                description: evt.description,
                imageDataUrl: evt.imageDataUrl || null,
                date: evt.date,
                startTime: evt.startTime,
                venue: evt.venue,
                capacity: evt.capacity,
                status: evt.status,
                prefix: evt.prefix,
                organizerId: evt.organizerId.toString(),
                startedAt: evt.startedAt ? new Date(evt.startedAt).toISOString() : null,
                endedAt: evt.endedAt ? new Date(evt.endedAt).toISOString() : null,
                registeredCount: c.registeredCount,
                checkedInCount: c.checkedInCount,
                createdAt: new Date(evt.createdAt).toISOString(),
                updatedAt: new Date(evt.updatedAt).toISOString(),
            };
        });
        res.json({ events: enriched });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch events.' });
    }
});
// Create draft event
router.post('/', authMiddleware_js_1.authMiddleware, async (req, res) => {
    try {
        const validated = createEventSchema.parse(req.body);
        const organizerId = req.organizer._id.toString();
        const event = await Event_js_1.Event.create({
            ...validated,
            prefix: (validated.prefix || 'EVT').toUpperCase().trim(),
            status: 'DRAFT',
            organizerId,
        });
        await (0, auditService_js_1.logAuditEvent)({
            eventId: event._id,
            organizerId,
            action: 'CREATE_EVENT',
            metadata: { name: event.name, capacity: event.capacity, prefix: event.prefix },
        });
        res.status(201).json({
            event: {
                id: event._id.toString(),
                name: event.name,
                description: event.description,
                imageDataUrl: event.imageDataUrl || null,
                date: event.date,
                startTime: event.startTime,
                venue: event.venue,
                capacity: event.capacity,
                status: event.status,
                prefix: event.prefix,
                organizerId: event.organizerId.toString(),
                startedAt: null,
                endedAt: null,
                registeredCount: 0,
                checkedInCount: 0,
                createdAt: new Date(event.createdAt).toISOString(),
                updatedAt: new Date(event.updatedAt).toISOString(),
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        res.status(500).json({ error: err.message || 'Failed to create event.' });
    }
});
// Public list of active events open for attendee registration
router.get('/public', async (_req, res) => {
    try {
        const events = await Event_js_1.Event.find({
            status: { $in: ['UPCOMING', 'LIVE', 'upcoming', 'live'] },
        })
            .sort({ createdAt: -1 })
            .lean();
        const countMap = await getAttendeeCounts(events.map((e) => e._id));
        const publicEvents = events.map((evt) => {
            const reg = countMap.get(evt._id.toString())?.registeredCount || 0;
            return {
                id: evt._id.toString(),
                name: evt.name,
                description: evt.description,
                imageDataUrl: evt.imageDataUrl || null,
                date: evt.date,
                startTime: evt.startTime,
                venue: evt.venue,
                capacity: evt.capacity,
                status: evt.status,
                prefix: evt.prefix,
                registeredCount: reg,
                isSoldOut: reg >= evt.capacity,
            };
        });
        res.json({ events: publicEvents });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to list public events.' });
    }
});
// Public event info route (for attendee registration page)
router.get('/public/:id', async (req, res) => {
    try {
        const rawId = req.params.id;
        const event = await Event_js_1.Event.findById(rawId);
        if (!event) {
            res.status(404).json({ error: 'Event not found.' });
            return;
        }
        const registeredCount = await Attendee_js_1.Attendee.countDocuments({ eventId: event._id });
        res.json({
            event: {
                id: event._id.toString(),
                name: event.name,
                description: event.description,
                imageDataUrl: event.imageDataUrl || null,
                date: event.date,
                startTime: event.startTime,
                venue: event.venue,
                capacity: event.capacity,
                status: event.status,
                prefix: event.prefix,
                registeredCount,
                isSoldOut: registeredCount >= event.capacity,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch public event.' });
    }
});
// Get single event detail (Organizer ownership verified)
router.get('/:id', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    const event = req.event;
    const registeredCount = await Attendee_js_1.Attendee.countDocuments({ eventId: event._id });
    const checkedInCount = await Attendee_js_1.Attendee.countDocuments({ eventId: event._id, checkedInAt: { $ne: null } });
    res.json({
        event: {
            id: event._id.toString(),
            name: event.name,
            description: event.description,
            imageDataUrl: event.imageDataUrl || null,
            date: event.date,
            startTime: event.startTime,
            venue: event.venue,
            capacity: event.capacity,
            status: event.status,
            prefix: event.prefix,
            organizerId: event.organizerId.toString(),
            startedAt: event.startedAt ? new Date(event.startedAt).toISOString() : null,
            endedAt: event.endedAt ? new Date(event.endedAt).toISOString() : null,
            registeredCount,
            checkedInCount,
            createdAt: new Date(event.createdAt).toISOString(),
            updatedAt: new Date(event.updatedAt).toISOString(),
        },
    });
});
// Update event details
router.patch('/:id', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const validated = updateEventSchema.parse(req.body);
        const event = req.event;
        if (validated.prefix && validated.prefix !== event.prefix) {
            const attendeeCount = await Attendee_js_1.Attendee.countDocuments({ eventId: event._id });
            if (attendeeCount > 0) {
                res.status(400).json({ error: 'Cannot change ticket prefix after attendees have registered.' });
                return;
            }
        }
        Object.assign(event, validated);
        if (validated.prefix) {
            event.prefix = validated.prefix.toUpperCase().trim();
        }
        await event.save();
        await (0, auditService_js_1.logAuditEvent)({
            eventId: event._id,
            organizerId: req.organizer._id,
            action: 'UPDATE_EVENT',
            metadata: validated,
        });
        res.json({ event });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        res.status(500).json({ error: err.message || 'Failed to update event.' });
    }
});
// Publish event (DRAFT -> UPCOMING)
router.post('/:id/publish', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    const event = req.event;
    if (event.status !== 'DRAFT') {
        res.status(400).json({ error: `Cannot publish event in status ${event.status}. Expected DRAFT.` });
        return;
    }
    event.status = 'UPCOMING';
    await event.save();
    await (0, auditService_js_1.logAuditEvent)({
        eventId: event._id,
        organizerId: req.organizer._id,
        action: 'PUBLISH_EVENT',
    });
    res.json({ success: true, event });
});
// Start event (UPCOMING -> LIVE)
router.post('/:id/start', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    const event = req.event;
    if (event.status !== 'UPCOMING' && event.status !== 'DRAFT') {
        res.status(400).json({ error: `Cannot start event in status ${event.status}.` });
        return;
    }
    event.status = 'LIVE';
    if (!event.startedAt) {
        event.startedAt = new Date();
    }
    await event.save();
    await (0, auditService_js_1.logAuditEvent)({
        eventId: event._id,
        organizerId: req.organizer._id,
        action: 'START_EVENT',
        metadata: { startedAt: event.startedAt },
    });
    res.json({ success: true, event });
});
// End event (LIVE -> ENDED)
router.post('/:id/end', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    const event = req.event;
    if (event.status !== 'LIVE' && event.status !== 'UPCOMING') {
        res.status(400).json({ error: `Cannot end event in status ${event.status}. Expected LIVE.` });
        return;
    }
    event.status = 'ENDED';
    event.endedAt = new Date();
    await event.save();
    await (0, auditService_js_1.logAuditEvent)({
        eventId: event._id,
        organizerId: req.organizer._id,
        action: 'END_EVENT',
        metadata: { endedAt: event.endedAt },
    });
    res.json({ success: true, event });
});
// Live Analytics Endpoint
router.get('/:id/analytics', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        const attendees = await Attendee_js_1.Attendee.find({ eventId: event._id }).lean();
        const registeredCount = attendees.length;
        const checkedInAttendees = attendees.filter((a) => a.checkedInAt !== null && a.checkedInAt !== undefined);
        const checkedInCount = checkedInAttendees.length;
        const remainingCapacity = Math.max(0, event.capacity - registeredCount);
        const attendanceRate = registeredCount > 0 ? Number(((checkedInCount / registeredCount) * 100).toFixed(1)) : 0;
        const ticketTypeBreakdown = {};
        attendees.forEach((a) => {
            const type = a.ticketType || 'General';
            if (!ticketTypeBreakdown[type]) {
                ticketTypeBreakdown[type] = { registered: 0, checkedIn: 0 };
            }
            ticketTypeBreakdown[type].registered += 1;
            if (a.checkedInAt) {
                ticketTypeBreakdown[type].checkedIn += 1;
            }
        });
        const checkInTimes = checkedInAttendees
            .map((a) => new Date(a.checkedInAt).getTime())
            .sort((a, b) => a - b);
        const checkInsOverTime = [];
        if (checkInTimes.length > 0) {
            const intervalMs = 15 * 60 * 1000;
            const startTime = Math.floor(checkInTimes[0] / intervalMs) * intervalMs;
            const endTime = Math.ceil(checkInTimes[checkInTimes.length - 1] / intervalMs) * intervalMs;
            let currentBucket = startTime;
            let runningTotal = 0;
            while (currentBucket <= endTime || currentBucket === startTime) {
                const bucketEnd = currentBucket + intervalMs;
                const count = checkInTimes.filter((t) => t >= currentBucket && t < bucketEnd).length;
                runningTotal += count;
                const dateObj = new Date(currentBucket);
                const timeLabel = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                checkInsOverTime.push({
                    time: timeLabel,
                    count,
                    cumulative: runningTotal,
                });
                currentBucket += intervalMs;
                if (currentBucket > startTime + 24 * 60 * 60 * 1000)
                    break;
            }
        }
        const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
        const recentCheckInRate = checkInTimes.filter((t) => t >= fifteenMinAgo).length;
        const analytics = {
            registeredCount,
            checkedInCount,
            remainingCapacity,
            capacity: event.capacity,
            attendanceRate,
            ticketTypeBreakdown,
            checkInsOverTime,
            recentCheckInRate,
        };
        res.json({ analytics });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to compute live analytics.' });
    }
});
// Post-Event Summary Endpoint
router.get('/:id/summary', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        const attendees = await Attendee_js_1.Attendee.find({ eventId: event._id }).lean();
        const auditLogs = await AuditLog_js_1.AuditLog.find({ eventId: event._id }).lean();
        const registeredCount = attendees.length;
        const checkedInAttendees = attendees
            .filter((a) => a.checkedInAt !== null && a.checkedInAt !== undefined)
            .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());
        const checkedInCount = checkedInAttendees.length;
        const attendanceRate = registeredCount > 0 ? Number(((checkedInCount / registeredCount) * 100).toFixed(1)) : 0;
        const noShowCount = Math.max(0, registeredCount - checkedInCount);
        const firstCheckInAt = checkedInAttendees.length > 0 ? new Date(checkedInAttendees[0].checkedInAt).toISOString() : null;
        const lastCheckInAt = checkedInAttendees.length > 0
            ? new Date(checkedInAttendees[checkedInAttendees.length - 1].checkedInAt).toISOString()
            : null;
        const ticketTypeBreakdown = {};
        let emailFailureCount = 0;
        attendees.forEach((a) => {
            const type = a.ticketType || 'General';
            if (!ticketTypeBreakdown[type]) {
                ticketTypeBreakdown[type] = { registered: 0, checkedIn: 0 };
            }
            ticketTypeBreakdown[type].registered += 1;
            if (a.checkedInAt) {
                ticketTypeBreakdown[type].checkedIn += 1;
            }
            if (!a.emailSent) {
                emailFailureCount += 1;
            }
        });
        const intervalMs = 15 * 60 * 1000;
        let peakCheckInPeriod = null;
        let maxBucketCount = 0;
        const checkInsOverTime = [];
        if (checkedInAttendees.length > 0) {
            const checkInTimes = checkedInAttendees.map((a) => new Date(a.checkedInAt).getTime());
            const startTime = Math.floor(checkInTimes[0] / intervalMs) * intervalMs;
            const endTime = Math.ceil(checkInTimes[checkInTimes.length - 1] / intervalMs) * intervalMs;
            let currentBucket = startTime;
            let runningTotal = 0;
            while (currentBucket <= endTime || currentBucket === startTime) {
                const bucketEnd = currentBucket + intervalMs;
                const count = checkInTimes.filter((t) => t >= currentBucket && t < bucketEnd).length;
                runningTotal += count;
                const dateObj = new Date(currentBucket);
                const timeLabel = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (count > maxBucketCount) {
                    maxBucketCount = count;
                    peakCheckInPeriod = `${timeLabel} (${count} check-ins)`;
                }
                checkInsOverTime.push({
                    time: timeLabel,
                    count,
                    cumulative: runningTotal,
                });
                currentBucket += intervalMs;
                if (currentBucket > startTime + 24 * 60 * 60 * 1000)
                    break;
            }
        }
        const duplicateScanCount = auditLogs.filter((l) => l.action === 'DUPLICATE_CHECK_IN').length;
        const invalidScanCount = auditLogs.filter((l) => l.action === 'INVALID_CHECK_IN').length;
        const offlineScansQueued = auditLogs.filter((l) => l.action === 'OFFLINE_SCAN_QUEUED').length;
        const offlineScansSynced = auditLogs.filter((l) => l.action === 'OFFLINE_SCAN_SYNCED').length;
        const summary = {
            eventId: event._id.toString(),
            eventName: event.name,
            venue: event.venue,
            date: event.date,
            startedAt: event.startedAt ? new Date(event.startedAt).toISOString() : null,
            endedAt: event.endedAt ? new Date(event.endedAt).toISOString() : null,
            registeredCount,
            checkedInCount,
            attendanceRate,
            noShowCount,
            firstCheckInAt,
            lastCheckInAt,
            peakCheckInPeriod,
            ticketTypeBreakdown,
            checkInsOverTime,
            emailFailureCount,
            duplicateScanCount,
            invalidScanCount,
            offlineScansQueued,
            offlineScansSynced,
        };
        res.json({ summary });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to compute post-event summary.' });
    }
});
// Event Audit Log Endpoint
router.get('/:id/audit-log', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const actionFilter = req.query.action;
        const query = { eventId: event._id };
        if (actionFilter && actionFilter !== 'ALL') {
            query.action = actionFilter;
        }
        const total = await AuditLog_js_1.AuditLog.countDocuments(query);
        const logs = await AuditLog_js_1.AuditLog.find(query)
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        const formattedLogs = logs.map((l) => ({
            id: l._id.toString(),
            eventId: l.eventId.toString(),
            attendeeId: l.attendeeId ? l.attendeeId.toString() : null,
            organizerId: l.organizerId ? l.organizerId.toString() : null,
            action: l.action,
            timestamp: new Date(l.timestamp).toISOString(),
            metadata: l.metadata,
            attendeeName: l.attendeeName,
            ticketCode: l.ticketCode,
        }));
        res.json({
            logs: formattedLogs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch audit log.' });
    }
});
// CSV Export Endpoint for Authorized Event
router.get('/:id/export/attendees.csv', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        const attendees = await Attendee_js_1.Attendee.find({ eventId: event._id }).sort({ registeredAt: 1 }).lean();
        const headers = ['Ticket Code', 'Name', 'Email', 'Ticket Type', 'Registered At', 'Check-In Status', 'Checked In At', 'Email Sent'];
        const rows = attendees.map((a) => {
            const isCheckedIn = a.checkedInAt ? 'Checked In' : 'Not Checked In';
            const checkedInTime = a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : 'N/A';
            const registeredTime = new Date(a.registeredAt).toLocaleString();
            return [
                `"${a.ticketCode.replace(/"/g, '""')}"`,
                `"${a.name.replace(/"/g, '""')}"`,
                `"${a.email.replace(/"/g, '""')}"`,
                `"${a.ticketType.replace(/"/g, '""')}"`,
                `"${registeredTime}"`,
                `"${isCheckedIn}"`,
                `"${checkedInTime}"`,
                `"${a.emailSent ? 'Yes' : 'No'}"`,
            ].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\r\n');
        const filename = `${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_attendees_${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to export CSV.' });
    }
});
// Delete event and cascading records (authorized organizer ownership verified)
router.delete('/:id', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        const eventId = event._id;
        // Cascade delete attendees & audit logs for this event
        const deletedAttendees = await Attendee_js_1.Attendee.deleteMany({ eventId });
        await AuditLog_js_1.AuditLog.deleteMany({ eventId });
        // Delete the event
        await Event_js_1.Event.findByIdAndDelete(eventId);
        res.json({
            success: true,
            message: `Event "${event.name}" and all associated data deleted successfully.`,
            deletedAttendeesCount: deletedAttendees?.deletedCount || 0,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to delete event.' });
    }
});
exports.default = router;
