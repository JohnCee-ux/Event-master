import { Router, Response } from 'express';
import { z } from 'zod';
import { Attendee } from '../models/Attendee.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireEventOwnership, EventAuthorizedRequest } from '../middleware/ownershipMiddleware.js';
import { logAuditEvent } from '../services/auditService.js';
import { SyncCheckInResponse } from '../types.js';

const router = Router();

const syncSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  deviceId: z.string().optional().default('unknown-device'),
  scans: z.array(
    z.object({
      scanId: z.string().min(1, 'scanId is required'),
      ticketCodeOrToken: z.string().min(1, 'Ticket code or QR token is required'),
      timestamp: z.string().min(1, 'Timestamp is required'),
      source: z.enum(['camera', 'manual']).optional().default('camera'),
    })
  ),
});

// Sync offline scans
router.post('/sync', authMiddleware, requireEventOwnership, async (req: EventAuthorizedRequest, res: Response): Promise<void> => {
  try {
    const validated = syncSchema.parse(req.body);
    const event = req.event!;
    const organizer = req.organizer!;
    const { deviceId, scans } = validated;

    if (event.status !== 'LIVE') {
      res.status(409).json({ error: 'Offline scans can only be synchronized while the event is live.' });
      return;
    }

    const sortedScans = [...scans].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const results: SyncCheckInResponse['results'] = [];

    for (const scan of sortedScans) {
      const cleanCode = scan.ticketCodeOrToken.trim();

      try {
        const scanTimestamp = new Date(scan.timestamp);
        if (isNaN(scanTimestamp.getTime()) || Math.abs(Date.now() - scanTimestamp.getTime()) > 24 * 60 * 60 * 1000) {
          results.push({ scanId: scan.scanId, status: 'FAILED', message: 'Offline timestamp is invalid or outside the permitted window.' });
          continue;
        }

        const attendee = await Attendee.findOne({
          eventId: event._id,
          $or: [{ ticketCode: cleanCode.toUpperCase() }, { qrToken: cleanCode }],
        });

        if (!attendee) {
          await logAuditEvent({
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
          await logAuditEvent({
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
        const claimedAttendee = await Attendee.findOneAndUpdate(
          { _id: attendee._id, checkedInAt: null, offlineScanIds: { $ne: scan.scanId } },
          {
            $set: { checkedInAt: validTime, checkedInBy: `Offline (${deviceId})` },
            $addToSet: { offlineScanIds: scan.scanId },
          }
        );

        if (!claimedAttendee) {
          results.push({ scanId: scan.scanId, status: 'DUPLICATE', message: 'Already checked in before sync.' });
          continue;
        }

        await logAuditEvent({
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
      } catch (itemErr: any) {
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
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: err.message || 'Sync operation failed.' });
  }
});

export default router;
