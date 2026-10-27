"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const Organizer_js_1 = require("../models/Organizer.js");
const Event_js_1 = require("../models/Event.js");
const Attendee_js_1 = require("../models/Attendee.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const superAdminMiddleware_js_1 = require("../middleware/superAdminMiddleware.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const emailService_js_1 = require("../services/emailService.js");
const otpRateLimiter_js_1 = require("../services/otpRateLimiter.js");
const router = (0, express_1.Router)();
const otpSchema = zod_1.z.object({ otp: zod_1.z.string().length(6, 'OTP must be 6 digits') });
const superAdminOtpStore = new Map();
const issueSuperAdminToken = (req, res) => {
    const organizer = req.organizer;
    const superAdminToken = jsonwebtoken_1.default.sign({
        id: organizer._id.toString(),
        email: organizer.email,
        role: 'superadmin',
        superAdminAuth: true,
    }, (0, authMiddleware_js_1.getJwtSecret)(), { expiresIn: '4h' });
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('superAdminToken', superAdminToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 4 * 60 * 60 * 1000,
    });
    res.json({ success: true, message: 'Super Admin access granted.', token: superAdminToken, expiresIn: '4h' });
};
// ── 1. Send Super Admin OTP ───────────────────────────────────────────────────
router.post('/request-otp', rateLimiter_js_1.authLimiter, authMiddleware_js_1.authMiddleware, async (req, res) => {
    try {
        if (!(0, superAdminMiddleware_js_1.isConfiguredSuperAdmin)(req.organizer?.email)) {
            res.status(403).json({ success: false, error: 'This account is not authorized to access Super Admin.' });
            return;
        }
        const email = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
        const quota = (0, otpRateLimiter_js_1.consumeOtpRequest)(email);
        if (!quota.allowed) {
            res.status(429).json({ error: `Too many OTP requests. Try again in ${Math.ceil(quota.retryAfterSeconds / 60)} minutes.` });
            return;
        }
        const existing = superAdminOtpStore.get(email);
        if (existing && existing.expiresAt - Date.now() > 8.5 * 60 * 1000) {
            res.status(429).json({ error: 'Please wait before requesting another code.' });
            return;
        }
        const otp = crypto_1.default.randomInt(100000, 1000000).toString();
        superAdminOtpStore.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
        const result = await (0, emailService_js_1.sendOtpEmail)(email, otp);
        if (!result.success) {
            superAdminOtpStore.delete(email);
            res.status(502).json({ error: 'Unable to send the Super Admin OTP.' });
            return;
        }
        res.json({ success: true, message: `A verification code was sent to ${email}.` });
    }
    catch (err) {
        console.error('Request Super Admin OTP error:', err);
        res.status(500).json({ error: 'Failed to send Super Admin OTP.' });
    }
});
// ── 2. Verify Super Admin OTP ─────────────────────────────────────────────────
router.post('/verify-otp', rateLimiter_js_1.authLimiter, authMiddleware_js_1.authMiddleware, async (req, res) => {
    try {
        if (!(0, superAdminMiddleware_js_1.isConfiguredSuperAdmin)(req.organizer?.email)) {
            res.status(403).json({ success: false, error: 'This account is not authorized to access Super Admin.' });
            return;
        }
        const { otp } = otpSchema.parse(req.body);
        const email = process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
        const record = superAdminOtpStore.get(email);
        if (!record) {
            res.status(400).json({ error: 'No active OTP found. Request a new code.' });
            return;
        }
        if (Date.now() > record.expiresAt) {
            superAdminOtpStore.delete(email);
            res.status(400).json({ error: 'OTP expired. Request a new code.' });
            return;
        }
        if (record.attempts >= 5) {
            superAdminOtpStore.delete(email);
            res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
            return;
        }
        if (record.otp !== otp.trim()) {
            record.attempts += 1;
            res.status(400).json({ error: 'Invalid Super Admin OTP.' });
            return;
        }
        superAdminOtpStore.delete(email);
        issueSuperAdminToken(req, res);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        console.error('Verify Super Admin OTP error:', err);
        res.status(500).json({ error: 'Failed to verify Super Admin OTP.' });
    }
});
// ── 3. Check Super Admin Status / Session ──────────────────────────────────────
router.get('/status', authMiddleware_js_1.authMiddleware, async (req, res) => {
    const token = req.headers['x-super-admin-token'] ||
        (req.cookies && req.cookies.superAdminToken);
    if (!token) {
        res.json({ unlocked: false, isSuperAdmin: (0, superAdminMiddleware_js_1.isConfiguredSuperAdmin)(req.organizer?.email) });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, authMiddleware_js_1.getJwtSecret)());
        if (decoded &&
            decoded.superAdminAuth &&
            decoded.id === req.organizer._id.toString() &&
            (0, superAdminMiddleware_js_1.isConfiguredSuperAdmin)(req.organizer?.email) &&
            (0, superAdminMiddleware_js_1.isConfiguredSuperAdmin)(decoded.email)) {
            res.json({ unlocked: true, isSuperAdmin: true, expiresAt: decoded.exp });
            return;
        }
        res.json({ unlocked: false, isSuperAdmin: (0, superAdminMiddleware_js_1.isConfiguredSuperAdmin)(req.organizer?.email) });
    }
    catch {
        res.json({ unlocked: false, isSuperAdmin: (0, superAdminMiddleware_js_1.isConfiguredSuperAdmin)(req.organizer?.email) });
    }
});
// ── 3. Lock Super Admin Session ───────────────────────────────────────────────
router.post('/lock', (_req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('superAdminToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/',
    });
    res.json({ success: true, message: 'Super admin session locked.' });
});
// All following routes require BOTH standard auth AND verified Super Admin OTP
router.use(authMiddleware_js_1.authMiddleware);
router.use(superAdminMiddleware_js_1.requireSuperAdmin);
// ── 4. Global Platform Overview & KPI Metrics ──────────────────────────────────
router.get('/overview', async (_req, res) => {
    try {
        const [allOrganizers, allEvents, allAttendees] = await Promise.all([
            Organizer_js_1.Organizer.find({}).sort({ createdAt: -1 }),
            Event_js_1.Event.find({}).sort({ createdAt: -1 }),
            Attendee_js_1.Attendee.find({}),
        ]);
        const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
        const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
        const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();
        const checkedInCount = attendeesList.filter((a) => !!a.checkedInAt).length;
        const eventsByStatus = {
            DRAFT: 0,
            UPCOMING: 0,
            LIVE: 0,
            ENDED: 0,
        };
        eventsList.forEach((e) => {
            const s = e.status || 'DRAFT';
            eventsByStatus[s] = (eventsByStatus[s] || 0) + 1;
        });
        const checkInRate = attendeesList.length > 0
            ? Math.round((checkedInCount / attendeesList.length) * 100)
            : 0;
        res.json({
            metrics: {
                totalOrganizers: organizersList.length,
                totalEvents: eventsList.length,
                totalAttendees: attendeesList.length,
                totalCheckedIn: checkedInCount,
                overallCheckInRate: checkInRate,
                eventsByStatus,
                storageEngine: 'Supabase PostgreSQL',
            },
            recentSignups: organizersList.slice(0, 6).map((o) => ({
                id: o._id.toString(),
                name: o.name,
                email: o.email,
                role: o.role || 'organizer',
                createdAt: o.createdAt,
            })),
            recentEvents: eventsList.slice(0, 6).map((e) => ({
                id: e._id.toString(),
                name: e.name,
                date: e.date,
                venue: e.venue,
                status: e.status,
                capacity: e.capacity,
                registeredCount: attendeesList.filter((a) => a.eventId?.toString() === e._id.toString()).length,
                createdAt: e.createdAt,
            })),
        });
    }
    catch (err) {
        console.error('Super Admin overview error:', err);
        res.status(500).json({ error: 'Failed to fetch platform metrics.' });
    }
});
// ── 5. List All Users / Sign-ups ───────────────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const queryStr = (req.query.query || '').toLowerCase().trim();
        const [allOrganizers, allEvents, allAttendees] = await Promise.all([
            Organizer_js_1.Organizer.find({}).sort({ createdAt: -1 }),
            Event_js_1.Event.find({}),
            Attendee_js_1.Attendee.find({}),
        ]);
        const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
        const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
        const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();
        // Map each organizer's event count and attendee count
        const organizerStats = new Map();
        eventsList.forEach((evt) => {
            const orgId = evt.organizerId ? evt.organizerId.toString() : '';
            if (!organizerStats.has(orgId)) {
                organizerStats.set(orgId, { eventsCount: 0, attendeesCount: 0, checkedInCount: 0 });
            }
            organizerStats.get(orgId).eventsCount += 1;
        });
        const eventToOrganizerMap = new Map();
        eventsList.forEach((e) => {
            eventToOrganizerMap.set(e._id.toString(), e.organizerId?.toString() || '');
        });
        attendeesList.forEach((att) => {
            const evtId = att.eventId ? att.eventId.toString() : '';
            const orgId = eventToOrganizerMap.get(evtId);
            if (orgId && organizerStats.has(orgId)) {
                organizerStats.get(orgId).attendeesCount += 1;
                if (att.checkedInAt) {
                    organizerStats.get(orgId).checkedInCount += 1;
                }
            }
        });
        let users = organizersList.map((org) => {
            const stats = organizerStats.get(org._id.toString()) || {
                eventsCount: 0,
                attendeesCount: 0,
                checkedInCount: 0,
            };
            return {
                id: org._id.toString(),
                name: org.name,
                email: org.email,
                role: org.role || 'organizer',
                createdAt: org.createdAt,
                updatedAt: org.updatedAt,
                eventsCount: stats.eventsCount,
                attendeesCount: stats.attendeesCount,
                checkedInCount: stats.checkedInCount,
                isCurrentSuperAdmin: org._id.toString() === req.organizer._id.toString(),
            };
        });
        if (queryStr) {
            users = users.filter((u) => u.name.toLowerCase().includes(queryStr) ||
                u.email.toLowerCase().includes(queryStr) ||
                u.id.toLowerCase().includes(queryStr));
        }
        res.json({ users, total: users.length });
    }
    catch (err) {
        console.error('Super Admin list users error:', err);
        res.status(500).json({ error: 'Failed to retrieve platform users.' });
    }
});
// ── 6. Delete a User / Sign-up (Cascading Deletion) ─────────────────────────────
router.delete('/users/:id', async (req, res) => {
    try {
        const targetUserId = req.params.id;
        // Protection: Super admin cannot delete themselves
        if (targetUserId === req.organizer._id.toString()) {
            res.status(400).json({
                error: 'Safety Guardrail: You cannot delete your own active Super Admin account.',
            });
            return;
        }
        const targetUser = await Organizer_js_1.Organizer.findById(targetUserId);
        if (!targetUser) {
            res.status(404).json({ error: 'User account not found.' });
            return;
        }
        // Find all events owned by this user
        const userEvents = await Event_js_1.Event.find({ organizerId: targetUserId });
        const userEventsList = Array.isArray(userEvents) ? userEvents : await userEvents.exec();
        const eventIds = userEventsList.map((e) => e._id.toString());
        let deletedAttendeesCount = 0;
        let deletedEventsCount = userEventsList.length;
        // Delete all attendees belonging to those events
        if (eventIds.length > 0) {
            const attendeeRes = await Attendee_js_1.Attendee.deleteMany({
                $or: eventIds.map((id) => ({ eventId: id })),
            });
            deletedAttendeesCount = attendeeRes?.deletedCount || 0;
            // Delete all audit logs belonging to those events
            await AuditLog_js_1.AuditLog.deleteMany({
                $or: eventIds.map((id) => ({ eventId: id })),
            });
            // Delete all events
            await Event_js_1.Event.deleteMany({
                organizerId: targetUserId,
            });
        }
        // Delete the organizer record
        await Organizer_js_1.Organizer.findByIdAndDelete(targetUserId);
        res.json({
            success: true,
            message: `User "${targetUser.name}" (${targetUser.email}) and all associated data deleted successfully.`,
            deletedEventsCount,
            deletedAttendeesCount,
        });
    }
    catch (err) {
        console.error('Super Admin delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});
// ── 7. List All Registered Events Across Platform ──────────────────────────────
router.get('/events', async (req, res) => {
    try {
        const queryStr = (req.query.query || '').toLowerCase().trim();
        const statusFilter = req.query.status || 'ALL';
        const organizerIdFilter = req.query.organizerId || '';
        const [allEvents, allOrganizers, allAttendees] = await Promise.all([
            Event_js_1.Event.find({}).sort({ createdAt: -1 }),
            Organizer_js_1.Organizer.find({}),
            Attendee_js_1.Attendee.find({}),
        ]);
        const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
        const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
        const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();
        const organizerMap = new Map();
        organizersList.forEach((org) => {
            organizerMap.set(org._id.toString(), {
                id: org._id.toString(),
                name: org.name,
                email: org.email,
            });
        });
        const attendeeStatsMap = new Map();
        attendeesList.forEach((att) => {
            const eId = att.eventId ? att.eventId.toString() : '';
            if (!attendeeStatsMap.has(eId)) {
                attendeeStatsMap.set(eId, { registered: 0, checkedIn: 0 });
            }
            const st = attendeeStatsMap.get(eId);
            st.registered += 1;
            if (att.checkedInAt)
                st.checkedIn += 1;
        });
        let results = eventsList.map((e) => {
            const orgIdStr = e.organizerId ? e.organizerId.toString() : '';
            const organizer = organizerMap.get(orgIdStr) || {
                id: orgIdStr,
                name: 'Unknown Organizer',
                email: 'unknown@gatekeeper.io',
            };
            const stats = attendeeStatsMap.get(e._id.toString()) || { registered: 0, checkedIn: 0 };
            const attendanceRate = stats.registered > 0 ? Math.round((stats.checkedIn / stats.registered) * 100) : 0;
            return {
                id: e._id.toString(),
                name: e.name,
                description: e.description || '',
                imageDataUrl: e.imageDataUrl || null,
                date: e.date,
                startTime: e.startTime,
                venue: e.venue,
                capacity: e.capacity,
                status: e.status,
                prefix: e.prefix,
                organizerId: orgIdStr,
                organizer,
                registeredCount: stats.registered,
                checkedInCount: stats.checkedIn,
                remainingCapacity: Math.max(0, e.capacity - stats.registered),
                attendanceRate,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt,
            };
        });
        if (organizerIdFilter) {
            results = results.filter((e) => e.organizerId === organizerIdFilter);
        }
        if (statusFilter !== 'ALL') {
            results = results.filter((e) => e.status === statusFilter);
        }
        if (queryStr) {
            results = results.filter((e) => e.name.toLowerCase().includes(queryStr) ||
                e.venue.toLowerCase().includes(queryStr) ||
                e.prefix.toLowerCase().includes(queryStr) ||
                e.organizer.name.toLowerCase().includes(queryStr) ||
                e.organizer.email.toLowerCase().includes(queryStr));
        }
        res.json({ events: results, total: results.length });
    }
    catch (err) {
        console.error('Super Admin list events error:', err);
        res.status(500).json({ error: 'Failed to retrieve platform events.' });
    }
});
// ── 8. Delete an Event (Cascading Deletion) ───────────────────────────────────
router.delete('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event_js_1.Event.findById(eventId);
        if (!event) {
            res.status(404).json({ error: 'Event not found.' });
            return;
        }
        // Delete all attendees belonging to this event
        const attendeeRes = await Attendee_js_1.Attendee.deleteMany({ eventId });
        const deletedAttendeesCount = attendeeRes?.deletedCount || 0;
        // Delete all audit logs
        await AuditLog_js_1.AuditLog.deleteMany({ eventId });
        // Delete the event
        await Event_js_1.Event.findByIdAndDelete(eventId);
        res.json({
            success: true,
            message: `Event "${event.name}" and ${deletedAttendeesCount} registrations deleted successfully.`,
            deletedAttendeesCount,
        });
    }
    catch (err) {
        console.error('Super Admin delete event error:', err);
        res.status(500).json({ error: 'Failed to delete event.' });
    }
});
// ── 9. List All Registrations (Attendees) Across Platform ─────────────────────
router.get('/registrations', async (req, res) => {
    try {
        const queryStr = (req.query.query || '').toLowerCase().trim();
        const eventIdFilter = req.query.eventId || '';
        const statusFilter = req.query.status || 'ALL'; // 'CHECKED_IN', 'NOT_CHECKED_IN', 'ALL'
        const [allAttendees, allEvents, allOrganizers] = await Promise.all([
            Attendee_js_1.Attendee.find({}).sort({ registeredAt: -1 }),
            Event_js_1.Event.find({}),
            Organizer_js_1.Organizer.find({}),
        ]);
        const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();
        const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
        const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
        const organizerMap = new Map();
        organizersList.forEach((o) => {
            organizerMap.set(o._id.toString(), {
                id: o._id.toString(),
                name: o.name,
                email: o.email,
            });
        });
        const eventMap = new Map();
        eventsList.forEach((e) => {
            const orgId = e.organizerId ? e.organizerId.toString() : '';
            eventMap.set(e._id.toString(), {
                id: e._id.toString(),
                name: e.name,
                prefix: e.prefix,
                date: e.date,
                venue: e.venue,
                organizer: organizerMap.get(orgId) || { name: 'Unknown', email: '' },
            });
        });
        let results = attendeesList.map((a) => {
            const eId = a.eventId ? a.eventId.toString() : '';
            const eventInfo = eventMap.get(eId) || {
                id: eId,
                name: 'Unlinked Event',
                prefix: 'N/A',
                date: 'N/A',
                venue: 'N/A',
                organizer: { name: 'Unknown', email: '' },
            };
            return {
                id: a._id.toString(),
                eventId: eId,
                name: a.name,
                email: a.email,
                ticketType: a.ticketType || 'General',
                ticketCode: a.ticketCode,
                qrToken: a.qrToken,
                registeredAt: a.registeredAt || a.createdAt,
                checkedInAt: a.checkedInAt || null,
                checkedInBy: a.checkedInBy || null,
                emailSent: !!a.emailSent,
                event: eventInfo,
            };
        });
        if (eventIdFilter) {
            results = results.filter((r) => r.eventId === eventIdFilter);
        }
        if (statusFilter === 'CHECKED_IN') {
            results = results.filter((r) => !!r.checkedInAt);
        }
        else if (statusFilter === 'NOT_CHECKED_IN') {
            results = results.filter((r) => !r.checkedInAt);
        }
        if (queryStr) {
            results = results.filter((r) => r.name.toLowerCase().includes(queryStr) ||
                r.email.toLowerCase().includes(queryStr) ||
                r.ticketCode.toLowerCase().includes(queryStr) ||
                r.event.name.toLowerCase().includes(queryStr));
        }
        res.json({ registrations: results, total: results.length });
    }
    catch (err) {
        console.error('Super Admin list registrations error:', err);
        res.status(500).json({ error: 'Failed to retrieve registrations.' });
    }
});
// ── 10. Delete a Single Registration ──────────────────────────────────────────
router.delete('/registrations/:id', async (req, res) => {
    try {
        const attendeeId = req.params.id;
        const attendee = await Attendee_js_1.Attendee.findById(attendeeId);
        if (!attendee) {
            res.status(404).json({ error: 'Attendee registration not found.' });
            return;
        }
        const eventId = attendee.eventId;
        await Attendee_js_1.Attendee.findByIdAndDelete(attendeeId);
        // Decrement event registeredCount if event exists
        if (eventId) {
            await Event_js_1.Event.findOneAndUpdate({ _id: eventId }, { $inc: { registeredCount: -1 } });
        }
        res.json({
            success: true,
            message: `Registration for "${attendee.name}" (${attendee.ticketCode}) deleted successfully.`,
        });
    }
    catch (err) {
        console.error('Super Admin delete registration error:', err);
        res.status(500).json({ error: 'Failed to delete attendee registration.' });
    }
});
// ── 11. CSV Data Export ────────────────────────────────────────────────────────
router.get('/export/:type', async (req, res) => {
    try {
        const exportType = req.params.type; // 'users' | 'events' | 'registrations'
        if (exportType === 'users') {
            const allOrganizers = await Organizer_js_1.Organizer.find({}).sort({ createdAt: -1 });
            const orgList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
            let csv = 'ID,Name,Email,Role,Registered At\n';
            orgList.forEach((u) => {
                csv += `"${u._id}","${(u.name || '').replace(/"/g, '""')}","${u.email}","${u.role || 'organizer'}","${u.createdAt}"\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="gatekeeper_all_users.csv"');
            res.send(csv);
            return;
        }
        if (exportType === 'events') {
            const allEvents = await Event_js_1.Event.find({}).sort({ createdAt: -1 });
            const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
            let csv = 'ID,Name,Status,Date,Time,Venue,Capacity,Prefix,Organizer ID\n';
            eventsList.forEach((e) => {
                csv += `"${e._id}","${(e.name || '').replace(/"/g, '""')}","${e.status}","${e.date}","${e.startTime}","${(e.venue || '').replace(/"/g, '""')}","${e.capacity}","${e.prefix}","${e.organizerId}"\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="gatekeeper_all_events.csv"');
            res.send(csv);
            return;
        }
        if (exportType === 'registrations') {
            const allAttendees = await Attendee_js_1.Attendee.find({}).sort({ registeredAt: -1 });
            const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();
            let csv = 'ID,Event ID,Name,Email,Ticket Type,Ticket Code,Registered At,Checked In At\n';
            attendeesList.forEach((a) => {
                csv += `"${a._id}","${a.eventId}","${(a.name || '').replace(/"/g, '""')}","${a.email}","${a.ticketType}","${a.ticketCode}","${a.registeredAt || a.createdAt}","${a.checkedInAt || 'Not Checked In'}"\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="gatekeeper_all_registrations.csv"');
            res.send(csv);
            return;
        }
        res.status(400).json({ error: 'Invalid export type. Must be users, events, or registrations.' });
    }
    catch (err) {
        console.error('Super Admin CSV export error:', err);
        res.status(500).json({ error: 'Export failed.' });
    }
});
exports.default = router;
