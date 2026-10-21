"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
const Event_js_1 = require("../models/Event.js");
const Attendee_js_1 = require("../models/Attendee.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const ownershipMiddleware_js_1 = require("../middleware/ownershipMiddleware.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const ticketService_js_1 = require("../services/ticketService.js");
const qrService_js_1 = require("../services/qrService.js");
const emailService_js_1 = require("../services/emailService.js");
const auditService_js_1 = require("../services/auditService.js");
const router = (0, express_1.Router)();
const publicRegisterSchema = zod_1.z.object({
    eventId: zod_1.z.string().min(1, 'Event ID is required'),
    name: zod_1.z.string().min(2, 'Full name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    ticketType: zod_1.z.string().optional().default('General'),
});
// Public Attendee Registration
router.post('/', rateLimiter_js_1.publicRegisterLimiter, async (req, res) => {
    try {
        const validated = publicRegisterSchema.parse(req.body);
        const normalizedEmail = validated.email.toLowerCase().trim();
        if (!mongoose_1.default.Types.ObjectId.isValid(validated.eventId)) {
            res.status(400).json({ error: 'Invalid event identifier.' });
            return;
        }
        const event = await Event_js_1.Event.findById(validated.eventId);
        if (!event) {
            res.status(404).json({ error: 'Event not found.' });
            return;
        }
        // Reject if event is DRAFT or ENDED
        if (event.status === 'DRAFT') {
            res.status(400).json({ error: 'Registration is not yet open for this event.' });
            return;
        }
        if (event.status === 'ENDED') {
            res.status(400).json({ error: 'This event has concluded. Registration is closed.' });
            return;
        }
        // Check for existing attendee with same email for this event
        const existingAttendee = await Attendee_js_1.Attendee.findOne({
            eventId: event._id,
            email: normalizedEmail,
        });
        if (existingAttendee) {
            // Return existing ticket credentials
            const qrDataUrl = await (0, qrService_js_1.generateQRCodeDataUrl)(existingAttendee.qrToken);
            res.json({
                success: true,
                message: 'You are already registered for this event. Here is your ticket.',
                attendee: {
                    id: existingAttendee._id.toString(),
                    name: existingAttendee.name,
                    email: existingAttendee.email,
                    ticketType: existingAttendee.ticketType,
                    ticketCode: existingAttendee.ticketCode,
                    qrToken: existingAttendee.qrToken,
                    qrDataUrl,
                    registeredAt: existingAttendee.registeredAt.toISOString(),
                    emailSent: existingAttendee.emailSent,
                },
                event: {
                    id: event._id.toString(),
                    name: event.name,
                    venue: event.venue,
                    date: event.date,
                    startTime: event.startTime,
                },
            });
            return;
        }
        // Reserve capacity atomically before creating the attendee.
        const capacityReservation = await Event_js_1.Event.findOneAndUpdate({ _id: event._id, $or: [{ registeredCount: { $lt: event.capacity } }, { registeredCount: { $exists: false } }] }, { $inc: { registeredCount: 1 } });
        if (!capacityReservation) {
            res.status(400).json({
                error: 'Event capacity reached. This event is sold out.',
                isSoldOut: true,
            });
            return;
        }
        // Generate secure ticket code and opaque QR token (no PII in QR payload)
        const { ticketCode, qrToken } = await (0, ticketService_js_1.createUniqueTicketCredentials)(event._id.toString(), event.prefix);
        let attendee;
        try {
            attendee = await Attendee_js_1.Attendee.create({
                eventId: event._id,
                name: validated.name.trim(),
                email: normalizedEmail,
                ticketType: validated.ticketType.trim(),
                ticketCode,
                qrToken,
                registeredAt: new Date(),
                emailSent: false,
            });
        }
        catch (createError) {
            await Event_js_1.Event.findOneAndUpdate({ _id: event._id }, { $inc: { registeredCount: -1 } });
            throw createError;
        }
        // Write audit log
        await (0, auditService_js_1.logAuditEvent)({
            eventId: event._id,
            attendeeId: attendee._id,
            action: 'REGISTER_ATTENDEE',
            metadata: { ticketType: attendee.ticketType },
            attendeeName: attendee.name,
            ticketCode: attendee.ticketCode,
        });
        // Generate QR Data URL
        const qrDataUrl = await (0, qrService_js_1.generateQRCodeDataUrl)(qrToken);
        // Send ticket email asynchronously without blocking registration
        (0, emailService_js_1.sendTicketEmail)({
            toEmail: attendee.email,
            attendeeName: attendee.name,
            eventName: event.name,
            venue: event.venue,
            date: event.date,
            startTime: event.startTime,
            ticketType: attendee.ticketType,
            ticketCode: attendee.ticketCode,
            qrDataUrl,
            imageDataUrl: event.imageDataUrl || null,
        })
            .then(async (emailResult) => {
            if (emailResult.success) {
                attendee.emailSent = true;
                attendee.emailLastAttemptAt = new Date();
                await attendee.save();
            }
            else {
                attendee.emailLastAttemptAt = new Date();
                await attendee.save();
            }
        })
            .catch((err) => {
            console.error('Async email error:', err);
        });
        res.status(201).json({
            success: true,
            message: 'Registration successful! Please save your ticket.',
            attendee: {
                id: attendee._id.toString(),
                name: attendee.name,
                email: attendee.email,
                ticketType: attendee.ticketType,
                ticketCode: attendee.ticketCode,
                qrToken: attendee.qrToken,
                qrDataUrl,
                registeredAt: attendee.registeredAt.toISOString(),
                emailSent: false,
            },
            event: {
                id: event._id.toString(),
                name: event.name,
                venue: event.venue,
                date: event.date,
                startTime: event.startTime,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        res.status(500).json({ error: err.message || 'Registration failed.' });
    }
});
// Public Ticket & QR Lookup for Attendees
router.post('/public-lookup', rateLimiter_js_1.publicLookupLimiter, async (req, res) => {
    try {
        const { email, ticketCode, eventId } = req.body;
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanCode = (ticketCode || '').trim().toUpperCase();
        if (!eventId || !mongoose_1.default.Types.ObjectId.isValid(eventId)) {
            res.status(400).json({ error: 'A valid event ID is required.' });
            return;
        }
        if (!cleanEmail && !cleanCode) {
            res.status(400).json({ error: 'Please provide either your registered email or your ticket code.' });
            return;
        }
        const query = { eventId };
        if (cleanCode) {
            query.ticketCode = cleanCode;
        }
        else if (cleanEmail) {
            query.email = cleanEmail;
        }
        const attendee = await Attendee_js_1.Attendee.findOne(query).sort({ registeredAt: -1 });
        if (!attendee) {
            res.status(404).json({ error: 'No ticket found matching the provided details.' });
            return;
        }
        const event = await Event_js_1.Event.findById(attendee.eventId);
        if (!event) {
            res.status(404).json({ error: 'Associated event could not be found.' });
            return;
        }
        const qrDataUrl = await (0, qrService_js_1.generateQRCodeDataUrl)(attendee.qrToken);
        res.json({
            success: true,
            message: 'Ticket retrieved successfully!',
            attendee: {
                id: attendee._id.toString(),
                name: attendee.name,
                email: attendee.email,
                ticketType: attendee.ticketType,
                ticketCode: attendee.ticketCode,
                qrToken: attendee.qrToken,
                qrDataUrl,
                registeredAt: attendee.registeredAt.toISOString(),
                emailSent: attendee.emailSent,
            },
            event: {
                id: event._id.toString(),
                name: event.name,
                venue: event.venue,
                date: event.date,
                startTime: event.startTime,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to retrieve ticket.' });
    }
});
// List attendees for organizer dashboard (Search, Filter, Pagination, Sort)
router.get('/', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const search = (req.query.search || '').trim();
        const filter = req.query.filter || 'all'; // all, checked-in, not-checked-in, email-failed
        const ticketType = req.query.ticketType || '';
        const sortBy = req.query.sortBy || 'registeredAt'; // registeredAt, name, ticketCode, checkedInAt
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const query = { eventId: event._id };
        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { ticketCode: { $regex: search, $options: 'i' } },
            ];
        }
        // Status filter
        if (filter === 'checked-in') {
            query.checkedInAt = { $ne: null };
        }
        else if (filter === 'not-checked-in') {
            query.checkedInAt = null;
        }
        else if (filter === 'email-failed') {
            query.emailSent = false;
        }
        // Ticket Type filter
        if (ticketType && ticketType !== 'ALL') {
            query.ticketType = ticketType;
        }
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder;
        const total = await Attendee_js_1.Attendee.countDocuments(query);
        const attendees = await Attendee_js_1.Attendee.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        const formattedAttendees = attendees.map((a) => ({
            id: a._id.toString(),
            eventId: a.eventId.toString(),
            name: a.name,
            email: a.email,
            ticketType: a.ticketType,
            ticketCode: a.ticketCode,
            qrToken: a.qrToken,
            registeredAt: a.registeredAt.toISOString(),
            checkedInAt: a.checkedInAt ? a.checkedInAt.toISOString() : null,
            checkedInBy: a.checkedInBy || null,
            emailSent: a.emailSent,
            emailLastAttemptAt: a.emailLastAttemptAt ? a.emailLastAttemptAt.toISOString() : null,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
        }));
        res.json({
            attendees: formattedAttendees,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to list attendees.' });
    }
});
// Fast lookup by ticket code or QR token
router.get('/lookup', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        const codeOrToken = (req.query.code || '').trim();
        if (!codeOrToken) {
            res.status(400).json({ error: 'Code or token parameter is required' });
            return;
        }
        const attendee = await Attendee_js_1.Attendee.findOne({
            eventId: event._id,
            $or: [{ ticketCode: codeOrToken.toUpperCase() }, { qrToken: codeOrToken }],
        }).lean();
        if (!attendee) {
            res.status(404).json({ error: 'No attendee found matching this code.' });
            return;
        }
        res.json({
            attendee: {
                id: attendee._id.toString(),
                eventId: attendee.eventId.toString(),
                name: attendee.name,
                email: attendee.email,
                ticketType: attendee.ticketType,
                ticketCode: attendee.ticketCode,
                qrToken: attendee.qrToken,
                registeredAt: attendee.registeredAt.toISOString(),
                checkedInAt: attendee.checkedInAt ? attendee.checkedInAt.toISOString() : null,
                checkedInBy: attendee.checkedInBy || null,
                emailSent: attendee.emailSent,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Lookup failed.' });
    }
});
// Direct Check-in by Ticket Code or QR Token (For Live Mode scanner & manual code entry)
router.post('/checkin-code', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const event = req.event;
        if (event.status !== 'LIVE') {
            res.status(409).json({ error: 'Check-in is only available while the event is live.' });
            return;
        }
        const { code, deviceId, source } = req.body;
        const cleanCode = (code || '').trim();
        if (!cleanCode) {
            res.status(400).json({ status: 'INVALID', message: 'Ticket code or QR token is required' });
            return;
        }
        const attendee = await Attendee_js_1.Attendee.findOne({
            eventId: event._id,
            $or: [{ ticketCode: cleanCode.toUpperCase() }, { qrToken: cleanCode }],
        });
        if (!attendee) {
            await (0, auditService_js_1.logAuditEvent)({
                eventId: event._id,
                organizerId: req.organizer._id,
                action: 'INVALID_CHECK_IN',
                metadata: { source: source || 'camera', deviceId },
                ticketCode: cleanCode.slice(0, 15),
            });
            res.status(200).json({
                status: 'INVALID',
                message: 'Invalid ticket. No registration found for this event.',
            });
            return;
        }
        // Check if already checked in (True duplicate)
        if (attendee.checkedInAt) {
            await (0, auditService_js_1.logAuditEvent)({
                eventId: event._id,
                attendeeId: attendee._id,
                organizerId: req.organizer._id,
                action: 'DUPLICATE_CHECK_IN',
                metadata: {
                    originalCheckInTime: attendee.checkedInAt,
                    deviceId,
                    source: source || 'camera',
                },
                attendeeName: attendee.name,
                ticketCode: attendee.ticketCode,
            });
            res.status(200).json({
                status: 'DUPLICATE',
                message: `Already checked in at ${new Date(attendee.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                attendee: {
                    id: attendee._id.toString(),
                    name: attendee.name,
                    email: attendee.email,
                    ticketType: attendee.ticketType,
                    ticketCode: attendee.ticketCode,
                    checkedInAt: attendee.checkedInAt.toISOString(),
                    originalCheckedInAt: attendee.checkedInAt.toISOString(),
                },
            });
            return;
        }
        // Atomically claim the attendee so concurrent scans cannot both succeed.
        const checkInTime = new Date();
        const claimedAttendee = await Attendee_js_1.Attendee.findOneAndUpdate({ _id: attendee._id, checkedInAt: null }, { $set: { checkedInAt: checkInTime, checkedInBy: req.organizer.name || 'Door Staff' } });
        if (!claimedAttendee) {
            const latestAttendee = await Attendee_js_1.Attendee.findById(attendee._id);
            res.status(200).json({
                status: 'DUPLICATE',
                message: 'Attendee is already checked in.',
                attendee: latestAttendee ? {
                    id: latestAttendee._id.toString(),
                    name: latestAttendee.name,
                    email: latestAttendee.email,
                    ticketType: latestAttendee.ticketType,
                    ticketCode: latestAttendee.ticketCode,
                    checkedInAt: latestAttendee.checkedInAt?.toISOString(),
                    originalCheckedInAt: latestAttendee.checkedInAt?.toISOString(),
                } : undefined,
            });
            return;
        }
        await (0, auditService_js_1.logAuditEvent)({
            eventId: event._id,
            attendeeId: attendee._id,
            organizerId: req.organizer._id,
            action: 'CHECK_IN',
            metadata: { deviceId, source: source || 'camera', checkInTime },
            attendeeName: attendee.name,
            ticketCode: attendee.ticketCode,
        });
        res.status(200).json({
            status: 'VALID',
            message: 'Check-in confirmed. Welcome!',
            attendee: {
                id: attendee._id.toString(),
                name: attendee.name,
                email: attendee.email,
                ticketType: attendee.ticketType,
                ticketCode: attendee.ticketCode,
                checkedInAt: checkInTime.toISOString(),
            },
            checkInTime: checkInTime.toISOString(),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Check-in processing failed.' });
    }
});
// Mark Attendee Checked In (by Attendee ID)
router.patch('/:id/checkin', authMiddleware_js_1.authMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        if (!mongoose_1.default.Types.ObjectId.isValid(rawId)) {
            res.status(400).json({ error: 'Invalid attendee ID.' });
            return;
        }
        const attendee = await Attendee_js_1.Attendee.findById(rawId);
        if (!attendee) {
            res.status(404).json({ error: 'Attendee not found.' });
            return;
        }
        // Verify organizer owns the event
        const event = await Event_js_1.Event.findOne({ _id: attendee.eventId, organizerId: req.organizer._id });
        if (!event) {
            res.status(403).json({ error: 'Access denied. You do not own this event.' });
            return;
        }
        if (event.status !== 'LIVE') {
            res.status(409).json({ error: 'Check-in is only available while the event is live.' });
            return;
        }
        if (attendee.checkedInAt) {
            res.json({
                status: 'DUPLICATE',
                message: 'Attendee is already checked in.',
                attendee: {
                    id: attendee._id.toString(),
                    name: attendee.name,
                    email: attendee.email,
                    ticketType: attendee.ticketType,
                    ticketCode: attendee.ticketCode,
                    checkedInAt: attendee.checkedInAt.toISOString(),
                },
            });
            return;
        }
        const checkInTime = new Date();
        const claimedAttendee = await Attendee_js_1.Attendee.findOneAndUpdate({ _id: attendee._id, checkedInAt: null }, { $set: { checkedInAt: checkInTime, checkedInBy: req.organizer.name } });
        if (!claimedAttendee) {
            res.json({ status: 'DUPLICATE', message: 'Attendee is already checked in.' });
            return;
        }
        await (0, auditService_js_1.logAuditEvent)({
            eventId: event._id,
            attendeeId: attendee._id,
            organizerId: req.organizer._id,
            action: 'CHECK_IN',
            metadata: { source: 'dashboard', checkInTime },
            attendeeName: attendee.name,
            ticketCode: attendee.ticketCode,
        });
        res.json({
            status: 'VALID',
            message: 'Attendee successfully checked in.',
            attendee: {
                id: attendee._id.toString(),
                name: attendee.name,
                email: attendee.email,
                ticketType: attendee.ticketType,
                ticketCode: attendee.ticketCode,
                checkedInAt: checkInTime.toISOString(),
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Check-in failed.' });
    }
});
// Undo Check-in (Reset checkedInAt to null and audit it)
router.patch('/:id/undo-checkin', authMiddleware_js_1.authMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        if (!mongoose_1.default.Types.ObjectId.isValid(rawId)) {
            res.status(400).json({ error: 'Invalid attendee ID.' });
            return;
        }
        const attendee = await Attendee_js_1.Attendee.findById(rawId);
        if (!attendee) {
            res.status(404).json({ error: 'Attendee not found.' });
            return;
        }
        // Verify organizer owns the event
        const event = await Event_js_1.Event.findOne({ _id: attendee.eventId, organizerId: req.organizer._id });
        if (!event) {
            res.status(403).json({ error: 'Access denied. You do not own this event.' });
            return;
        }
        const previousCheckInTime = attendee.checkedInAt;
        attendee.checkedInAt = null;
        attendee.checkedInBy = null;
        await attendee.save();
        await (0, auditService_js_1.logAuditEvent)({
            eventId: event._id,
            attendeeId: attendee._id,
            organizerId: req.organizer._id,
            action: 'UNDO_CHECK_IN',
            metadata: {
                previousCheckInTime,
                reason: req.body.reason || 'Accidental scan / organizer undo',
            },
            attendeeName: attendee.name,
            ticketCode: attendee.ticketCode,
        });
        res.json({
            success: true,
            message: 'Check-in reversed successfully.',
            attendee: {
                id: attendee._id.toString(),
                name: attendee.name,
                email: attendee.email,
                ticketType: attendee.ticketType,
                ticketCode: attendee.ticketCode,
                checkedInAt: null,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Undo check-in failed.' });
    }
});
// Resend Ticket Email
router.post('/:id/resend-ticket', authMiddleware_js_1.authMiddleware, async (req, res) => {
    try {
        const rawId = req.params.id;
        if (!mongoose_1.default.Types.ObjectId.isValid(rawId)) {
            res.status(400).json({ error: 'Invalid attendee ID.' });
            return;
        }
        const attendee = await Attendee_js_1.Attendee.findById(rawId);
        if (!attendee) {
            res.status(404).json({ error: 'Attendee not found.' });
            return;
        }
        const event = await Event_js_1.Event.findOne({ _id: attendee.eventId, organizerId: req.organizer._id });
        if (!event) {
            res.status(403).json({ error: 'Access denied. You do not own this event.' });
            return;
        }
        const qrDataUrl = await (0, qrService_js_1.generateQRCodeDataUrl)(attendee.qrToken);
        const emailResult = await (0, emailService_js_1.sendTicketEmail)({
            toEmail: attendee.email,
            attendeeName: attendee.name,
            eventName: event.name,
            venue: event.venue,
            date: event.date,
            startTime: event.startTime,
            ticketType: attendee.ticketType,
            ticketCode: attendee.ticketCode,
            qrDataUrl,
            imageDataUrl: event.imageDataUrl || null,
        });
        attendee.emailLastAttemptAt = new Date();
        if (emailResult.success) {
            attendee.emailSent = true;
        }
        await attendee.save();
        await (0, auditService_js_1.logAuditEvent)({
            eventId: event._id,
            attendeeId: attendee._id,
            organizerId: req.organizer._id,
            action: 'RESEND_TICKET',
            metadata: { success: emailResult.success, error: emailResult.error },
            attendeeName: attendee.name,
            ticketCode: attendee.ticketCode,
        });
        if (emailResult.success) {
            res.json({
                success: true,
                message: `Ticket email successfully sent to ${attendee.email}`,
                previewUrl: emailResult.previewUrl,
            });
        }
        else {
            res.status(500).json({
                error: `Failed to deliver email: ${emailResult.error}`,
            });
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Resend ticket failed.' });
    }
});
exports.default = router;
