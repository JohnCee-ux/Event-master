"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const Attendee_js_1 = require("../models/Attendee.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const ownershipMiddleware_js_1 = require("../middleware/ownershipMiddleware.js");
const auditService_js_1 = require("../services/auditService.js");
const router = (0, express_1.Router)();
const syncSchema = zod_1.z.object({
    eventId: zod_1.z.string().min(1, 'Event ID is required'),
    deviceId: zod_1.z.string().optional().default('unknown-device'),
    scans: zod_1.z.array(zod_1.z.object({
        scanId: zod_1.z.string().min(1, 'scanId is required'),
        ticketCodeOrToken: zod_1.z.string().min(1, 'Ticket code or QR token is required'),
        timestamp: zod_1.z.string().min(1, 'Timestamp is required'),
        source: zod_1.z.enum(['camera', 'manual']).optional().default('camera'),
    })),
});
// Sync offline scans
router.post('/sync', authMiddleware_js_1.authMiddleware, ownershipMiddleware_js_1.requireEventOwnership, async (req, res) => {
    try {
        const validated = syncSchema.parse(req.body);
        const event = req.event;
        const organizer = req.organizer;
        const { deviceId, scans } = validated;
        if (event.status !== 'LIVE') {
            res.status(409).json({ error: 'Offline scans can only be synchronized while the event is live.' });
            return;
        }
        const sortedScans = [...scans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const results = [];
        for (const scan of sortedScans) {
            const cleanCode = scan.ticketCodeOrToken.trim();
            try {
                const scanTimestamp = new Date(scan.timestamp);
                if (isNaN(scanTimestamp.getTime()) || Math.abs(Date.now() - scanTimestamp.getTime()) > 24 * 60 * 60 * 1000) {
                    results.push({ scanId: scan.scanId, status: 'FAILED', message: 'Offline timestamp is invalid or outside the permitted window.' });
                    continue;
                }
                const attendee = await Attendee_js_1.Attendee.findOne({
                    eventId: event._id,
                    $or: [{ ticketCode: cleanCode.toUpperCase() }, { qrToken: cleanCode }],
                });
                if (!attendee) {
                    await (0, auditService_js_1.logAuditEvent)({
                        eventId: event._id,
                        organizerId: organizer._id,
                        action: 'OFFLINE_SCAN_REJECTED',
                        metadata: {
                            scanId: scan.scanId,
                            deviceId,
                            reason: 'Ticket not found',
                            offlineTimestamp: scan.timestamp,
                        },
                        ticketCode: cleanCode.slice(0, 15),
                    });
                    results.push({
                        scanId: scan.scanId,
                        status: 'INVALID',
                        message: 'Invalid ticket. No attendee matching this code found.',
                    });
                    continue;
                }
                if (attendee.checkedInAt) {
                    await (0, auditService_js_1.logAuditEvent)({
                        eventId: event._id,
                        attendeeId: attendee._id,
                        organizerId: organizer._id,
                        action: 'DUPLICATE_CHECK_IN',
                        metadata: {
                            scanId: scan.scanId,
                            deviceId,
                            conflict: 'Already checked in before sync',
                            originalCheckInTime: attendee.checkedInAt,
                            offlineTimestamp: scan.timestamp,
                        },
                        attendeeName: attendee.name,
                        ticketCode: attendee.ticketCode,
                    });
                    results.push({
                        scanId: scan.scanId,
                        status: 'DUPLICATE',
                        message: `Already checked in at ${new Date(attendee.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                        attendee: {
                            id: attendee._id.toString(),
                            name: attendee.name,
                            email: attendee.email,
                            ticketType: attendee.ticketType,
                            ticketCode: attendee.ticketCode,
                            checkedInAt: new Date(attendee.checkedInAt).toISOString(),
                            originalCheckedInAt: new Date(attendee.checkedInAt).toISOString(),
                        },
                    });
                    continue;
                }
                const validTime = scanTimestamp;
                const claimedAttendee = await Attendee_js_1.Attendee.findOneAndUpdate({ _id: attendee._id, checkedInAt: null, offlineScanIds: { $ne: scan.scanId } }, {
                    $set: { checkedInAt: validTime, checkedInBy: `Offline (${deviceId})` },
                    $addToSet: { offlineScanIds: scan.scanId },
                });
                if (!claimedAttendee) {
                    results.push({ scanId: scan.scanId, status: 'DUPLICATE', message: 'Already checked in before sync.' });
                    continue;
                }
                await (0, auditService_js_1.logAuditEvent)({
                    eventId: event._id,
                    attendeeId: attendee._id,
                    organizerId: organizer._id,
                    action: 'OFFLINE_SCAN_SYNCED',
                    metadata: {
                        scanId: scan.scanId,
                        deviceId,
                        source: scan.source,
                        recordedOfflineAt: validTime,
                        syncedAt: new Date(),
                    },
                    attendeeName: attendee.name,
                    ticketCode: attendee.ticketCode,
                });
                results.push({
                    scanId: scan.scanId,
                    status: 'VALID',
                    message: 'Offline check-in successfully synced.',
                    attendee: {
                        id: attendee._id.toString(),
                        name: attendee.name,
                        email: attendee.email,
                        ticketType: attendee.ticketType,
                        ticketCode: attendee.ticketCode,
                        checkedInAt: validTime.toISOString(),
                    },
                });
            }
            catch (itemErr) {
                results.push({
                    scanId: scan.scanId,
                    status: 'FAILED',
                    message: 'Database error while syncing item.',
                    error: itemErr.message || 'Sync failed',
                });
            }
        }
        res.json({
            totalProcessed: results.length,
            results,
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: err.errors[0].message });
            return;
        }
        res.status(500).json({ error: err.message || 'Sync operation failed.' });
    }
});
exports.default = router;
