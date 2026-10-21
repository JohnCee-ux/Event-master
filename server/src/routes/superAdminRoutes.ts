import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Organizer } from '../models/Organizer.js';
import { Event } from '../models/Event.js';
import { Attendee } from '../models/Attendee.js';
import { AuditLog } from '../models/AuditLog.js';
import { authMiddleware, AuthenticatedRequest, getJwtSecret } from '../middleware/authMiddleware.js';
import {
  requireSuperAdmin,
  SuperAdminRequest,
  getSuperAdminPasscode,
} from '../middleware/superAdminMiddleware.js';
import { isUsingMemoryStore } from '../config/db.js';
import { memoryStore } from '../config/memoryDb.js';

const router = Router();

const passcodeSchema = z.object({
  passcode: z.string().min(1, 'Passcode is required'),
});

// ── 1. Verify Super Admin Master Passcode ──────────────────────────────────────
router.post(
  '/verify-passcode',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const validated = passcodeSchema.parse(req.body);
      const configuredPasscode = getSuperAdminPasscode();

      if (validated.passcode.trim() !== configuredPasscode.trim()) {
        res.status(401).json({
          success: false,
          error: 'Invalid Super Admin passcode. Access denied.',
        });
        return;
      }

      const organizer = req.organizer!;

      // Automatically upgrade or mark role as superadmin if needed
      if (organizer.role !== 'superadmin') {
        organizer.role = 'superadmin';
        if (typeof organizer.save === 'function') {
          await organizer.save();
        }
      }

      // Generate a dedicated, scoped Super Admin Token valid for 4 hours
      const superAdminToken = jwt.sign(
        {
          id: organizer._id.toString(),
          email: organizer.email,
          role: 'superadmin',
          superAdminAuth: true,
        },
        getJwtSecret(),
        { expiresIn: '4h' }
      );

      // Set cookie as well for convenience
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('superAdminToken', superAdminToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 4 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        message: 'Super Admin access granted.',
        token: superAdminToken,
        expiresIn: '4h',
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.errors[0].message });
        return;
      }
      console.error('Verify passcode error:', err);
      res.status(500).json({ error: 'Failed to verify super admin passcode.' });
    }
  }
);

// ── 2. Check Super Admin Status / Session ──────────────────────────────────────
router.get(
  '/status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token =
      (req.headers['x-super-admin-token'] as string) ||
      (req.cookies && req.cookies.superAdminToken);

    if (!token) {
      res.json({ unlocked: false, isSuperAdmin: req.organizer?.role === 'superadmin' });
      return;
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      if (
        decoded &&
        decoded.superAdminAuth &&
        decoded.id === req.organizer!._id.toString()
      ) {
        res.json({ unlocked: true, isSuperAdmin: true, expiresAt: decoded.exp });
        return;
      }
      res.json({ unlocked: false, isSuperAdmin: req.organizer?.role === 'superadmin' });
    } catch {
      res.json({ unlocked: false, isSuperAdmin: req.organizer?.role === 'superadmin' });
    }
  }
);

// ── 3. Lock Super Admin Session ───────────────────────────────────────────────
router.post('/lock', (_req: Request, res: Response): void => {
  res.clearCookie('superAdminToken');
  res.json({ success: true, message: 'Super admin session locked.' });
});

// All following routes require BOTH standard auth AND verified Super Admin passcode
router.use(authMiddleware as any);
router.use(requireSuperAdmin as any);

// ── 4. Global Platform Overview & KPI Metrics ──────────────────────────────────
router.get('/overview', async (_req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const [allOrganizers, allEvents, allAttendees] = await Promise.all([
      Organizer.find({}).sort({ createdAt: -1 }),
      Event.find({}).sort({ createdAt: -1 }),
      Attendee.find({}),
    ]);

    const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
    const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
    const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();

    const checkedInCount = attendeesList.filter((a: any) => !!a.checkedInAt).length;

    const eventsByStatus: Record<string, number> = {
      DRAFT: 0,
      UPCOMING: 0,
      LIVE: 0,
      ENDED: 0,
    };

    eventsList.forEach((e: any) => {
      const s = e.status || 'DRAFT';
      eventsByStatus[s] = (eventsByStatus[s] || 0) + 1;
    });

    const checkInRate =
      attendeesList.length > 0
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
        storageEngine: isUsingMemoryStore ? 'High-Speed In-Memory Store' : 'MongoDB Atlas Cluster',
      },
      recentSignups: organizersList.slice(0, 6).map((o: any) => ({
        id: o._id.toString(),
        name: o.name,
        email: o.email,
        role: o.role || 'organizer',
        createdAt: o.createdAt,
      })),
      recentEvents: eventsList.slice(0, 6).map((e: any) => ({
        id: e._id.toString(),
        name: e.name,
        date: e.date,
        venue: e.venue,
        status: e.status,
        capacity: e.capacity,
        registeredCount: attendeesList.filter((a: any) => a.eventId?.toString() === e._id.toString()).length,
        createdAt: e.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('Super Admin overview error:', err);
    res.status(500).json({ error: 'Failed to fetch platform metrics.' });
  }
});

// ── 5. List All Users / Sign-ups ───────────────────────────────────────────────
router.get('/users', async (req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const queryStr = ((req.query.query as string) || '').toLowerCase().trim();

    const [allOrganizers, allEvents, allAttendees] = await Promise.all([
      Organizer.find({}).sort({ createdAt: -1 }),
      Event.find({}),
      Attendee.find({}),
    ]);

    const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
    const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
    const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();

    // Map each organizer's event count and attendee count
    const organizerStats = new Map<string, { eventsCount: number; attendeesCount: number; checkedInCount: number }>();

    eventsList.forEach((evt: any) => {
      const orgId = evt.organizerId ? evt.organizerId.toString() : '';
      if (!organizerStats.has(orgId)) {
        organizerStats.set(orgId, { eventsCount: 0, attendeesCount: 0, checkedInCount: 0 });
      }
      organizerStats.get(orgId)!.eventsCount += 1;
    });

    const eventToOrganizerMap = new Map<string, string>();
    eventsList.forEach((e: any) => {
      eventToOrganizerMap.set(e._id.toString(), e.organizerId?.toString() || '');
    });

    attendeesList.forEach((att: any) => {
      const evtId = att.eventId ? att.eventId.toString() : '';
      const orgId = eventToOrganizerMap.get(evtId);
      if (orgId && organizerStats.has(orgId)) {
        organizerStats.get(orgId)!.attendeesCount += 1;
        if (att.checkedInAt) {
          organizerStats.get(orgId)!.checkedInCount += 1;
        }
      }
    });

    let users = organizersList.map((org: any) => {
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
        isCurrentSuperAdmin: org._id.toString() === req.organizer!._id.toString(),
      };
    });

    if (queryStr) {
      users = users.filter(
        (u: any) =>
          u.name.toLowerCase().includes(queryStr) ||
          u.email.toLowerCase().includes(queryStr) ||
          u.id.toLowerCase().includes(queryStr)
      );
    }

    res.json({ users, total: users.length });
  } catch (err: any) {
    console.error('Super Admin list users error:', err);
    res.status(500).json({ error: 'Failed to retrieve platform users.' });
  }
});

// ── 6. Delete a User / Sign-up (Cascading Deletion) ─────────────────────────────
router.delete('/users/:id', async (req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id;

    // Protection: Super admin cannot delete themselves
    if (targetUserId === req.organizer!._id.toString()) {
      res.status(400).json({
        error: 'Safety Guardrail: You cannot delete your own active Super Admin account.',
      });
      return;
    }

    const targetUser = await Organizer.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    // Find all events owned by this user
    const userEvents: any = await Event.find({ organizerId: targetUserId });
    const userEventsList: any[] = Array.isArray(userEvents) ? userEvents : await (userEvents as any).exec();
    const eventIds: string[] = userEventsList.map((e: any) => e._id.toString());

    let deletedAttendeesCount = 0;
    let deletedEventsCount = userEventsList.length;

    // Delete all attendees belonging to those events
    if (eventIds.length > 0) {
      const attendeeRes = await Attendee.deleteMany({
        $or: eventIds.map((id: string) => ({ eventId: id })),
      });
      deletedAttendeesCount = attendeeRes?.deletedCount || 0;

      // Delete all audit logs belonging to those events
      await AuditLog.deleteMany({
        $or: eventIds.map((id: string) => ({ eventId: id })),
      });

      // Delete all events
      await Event.deleteMany({
        organizerId: targetUserId,
      });
    }

    // Delete the organizer record
    await Organizer.findByIdAndDelete(targetUserId);

    res.json({
      success: true,
      message: `User "${targetUser.name}" (${targetUser.email}) and all associated data deleted successfully.`,
      deletedEventsCount,
      deletedAttendeesCount,
    });
  } catch (err: any) {
    console.error('Super Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// ── 7. List All Registered Events Across Platform ──────────────────────────────
router.get('/events', async (req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const queryStr = ((req.query.query as string) || '').toLowerCase().trim();
    const statusFilter = (req.query.status as string) || 'ALL';
    const organizerIdFilter = (req.query.organizerId as string) || '';

    const [allEvents, allOrganizers, allAttendees] = await Promise.all([
      Event.find({}).sort({ createdAt: -1 }),
      Organizer.find({}),
      Attendee.find({}),
    ]);

    const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
    const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();
    const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();

    const organizerMap = new Map<string, { id: string; name: string; email: string }>();
    organizersList.forEach((org: any) => {
      organizerMap.set(org._id.toString(), {
        id: org._id.toString(),
        name: org.name,
        email: org.email,
      });
    });

    const attendeeStatsMap = new Map<string, { registered: number; checkedIn: number }>();
    attendeesList.forEach((att: any) => {
      const eId = att.eventId ? att.eventId.toString() : '';
      if (!attendeeStatsMap.has(eId)) {
        attendeeStatsMap.set(eId, { registered: 0, checkedIn: 0 });
      }
      const st = attendeeStatsMap.get(eId)!;
      st.registered += 1;
      if (att.checkedInAt) st.checkedIn += 1;
    });

    let results = eventsList.map((e: any) => {
      const orgIdStr = e.organizerId ? e.organizerId.toString() : '';
      const organizer = organizerMap.get(orgIdStr) || {
        id: orgIdStr,
        name: 'Unknown Organizer',
        email: 'unknown@gatekeeper.io',
      };
      const stats = attendeeStatsMap.get(e._id.toString()) || { registered: 0, checkedIn: 0 };
      const attendanceRate =
        stats.registered > 0 ? Math.round((stats.checkedIn / stats.registered) * 100) : 0;

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
      results = results.filter((e: any) => e.organizerId === organizerIdFilter);
    }

    if (statusFilter !== 'ALL') {
      results = results.filter((e: any) => e.status === statusFilter);
    }

    if (queryStr) {
      results = results.filter(
        (e: any) =>
          e.name.toLowerCase().includes(queryStr) ||
          e.venue.toLowerCase().includes(queryStr) ||
          e.prefix.toLowerCase().includes(queryStr) ||
          e.organizer.name.toLowerCase().includes(queryStr) ||
          e.organizer.email.toLowerCase().includes(queryStr)
      );
    }

    res.json({ events: results, total: results.length });
  } catch (err: any) {
    console.error('Super Admin list events error:', err);
    res.status(500).json({ error: 'Failed to retrieve platform events.' });
  }
});

// ── 8. Delete an Event (Cascading Deletion) ───────────────────────────────────
router.delete('/events/:id', async (req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const eventId = req.params.id;

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ error: 'Event not found.' });
      return;
    }

    // Delete all attendees belonging to this event
    const attendeeRes = await Attendee.deleteMany({ eventId });
    const deletedAttendeesCount = attendeeRes?.deletedCount || 0;

    // Delete all audit logs
    await AuditLog.deleteMany({ eventId });

    // Delete the event
    await Event.findByIdAndDelete(eventId);

    res.json({
      success: true,
      message: `Event "${event.name}" and ${deletedAttendeesCount} registrations deleted successfully.`,
      deletedAttendeesCount,
    });
  } catch (err: any) {
    console.error('Super Admin delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

// ── 9. List All Registrations (Attendees) Across Platform ─────────────────────
router.get('/registrations', async (req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const queryStr = ((req.query.query as string) || '').toLowerCase().trim();
    const eventIdFilter = (req.query.eventId as string) || '';
    const statusFilter = (req.query.status as string) || 'ALL'; // 'CHECKED_IN', 'NOT_CHECKED_IN', 'ALL'

    const [allAttendees, allEvents, allOrganizers] = await Promise.all([
      Attendee.find({}).sort({ registeredAt: -1 }),
      Event.find({}),
      Organizer.find({}),
    ]);

    const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();
    const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();
    const organizersList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();

    const organizerMap = new Map<string, { id: string; name: string; email: string }>();
    organizersList.forEach((o: any) => {
      organizerMap.set(o._id.toString(), {
        id: o._id.toString(),
        name: o.name,
        email: o.email,
      });
    });

    const eventMap = new Map<string, any>();
    eventsList.forEach((e: any) => {
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

    let results = attendeesList.map((a: any) => {
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
      results = results.filter((r: any) => r.eventId === eventIdFilter);
    }

    if (statusFilter === 'CHECKED_IN') {
      results = results.filter((r: any) => !!r.checkedInAt);
    } else if (statusFilter === 'NOT_CHECKED_IN') {
      results = results.filter((r: any) => !r.checkedInAt);
    }

    if (queryStr) {
      results = results.filter(
        (r: any) =>
          r.name.toLowerCase().includes(queryStr) ||
          r.email.toLowerCase().includes(queryStr) ||
          r.ticketCode.toLowerCase().includes(queryStr) ||
          r.event.name.toLowerCase().includes(queryStr)
      );
    }

    res.json({ registrations: results, total: results.length });
  } catch (err: any) {
    console.error('Super Admin list registrations error:', err);
    res.status(500).json({ error: 'Failed to retrieve registrations.' });
  }
});

// ── 10. Delete a Single Registration ──────────────────────────────────────────
router.delete('/registrations/:id', async (req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const attendeeId = req.params.id;

    const attendee = await Attendee.findById(attendeeId);
    if (!attendee) {
      res.status(404).json({ error: 'Attendee registration not found.' });
      return;
    }

    const eventId = attendee.eventId;
    await Attendee.findByIdAndDelete(attendeeId);

    // Decrement event registeredCount if event exists
    if (eventId) {
      await Event.findOneAndUpdate({ _id: eventId }, { $inc: { registeredCount: -1 } });
    }

    res.json({
      success: true,
      message: `Registration for "${attendee.name}" (${attendee.ticketCode}) deleted successfully.`,
    });
  } catch (err: any) {
    console.error('Super Admin delete registration error:', err);
    res.status(500).json({ error: 'Failed to delete attendee registration.' });
  }
});

// ── 11. CSV Data Export ────────────────────────────────────────────────────────
router.get('/export/:type', async (req: SuperAdminRequest, res: Response): Promise<void> => {
  try {
    const exportType = req.params.type; // 'users' | 'events' | 'registrations'

    if (exportType === 'users') {
      const allOrganizers: any = await Organizer.find({}).sort({ createdAt: -1 });
      const orgList = Array.isArray(allOrganizers) ? allOrganizers : await allOrganizers.exec();

      let csv = 'ID,Name,Email,Role,Registered At\n';
      orgList.forEach((u: any) => {
        csv += `"${u._id}","${(u.name || '').replace(/"/g, '""')}","${u.email}","${u.role || 'organizer'}","${u.createdAt}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="gatekeeper_all_users.csv"');
      res.send(csv);
      return;
    }

    if (exportType === 'events') {
      const allEvents: any = await Event.find({}).sort({ createdAt: -1 });
      const eventsList = Array.isArray(allEvents) ? allEvents : await allEvents.exec();

      let csv = 'ID,Name,Status,Date,Time,Venue,Capacity,Prefix,Organizer ID\n';
      eventsList.forEach((e: any) => {
        csv += `"${e._id}","${(e.name || '').replace(/"/g, '""')}","${e.status}","${e.date}","${e.startTime}","${(e.venue || '').replace(/"/g, '""')}","${e.capacity}","${e.prefix}","${e.organizerId}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="gatekeeper_all_events.csv"');
      res.send(csv);
      return;
    }

    if (exportType === 'registrations') {
      const allAttendees: any = await Attendee.find({}).sort({ registeredAt: -1 });
      const attendeesList = Array.isArray(allAttendees) ? allAttendees : await allAttendees.exec();

      let csv = 'ID,Event ID,Name,Email,Ticket Type,Ticket Code,Registered At,Checked In At\n';
      attendeesList.forEach((a: any) => {
        csv += `"${a._id}","${a.eventId}","${(a.name || '').replace(/"/g, '""')}","${a.email}","${a.ticketType}","${a.ticketCode}","${a.registeredAt || a.createdAt}","${a.checkedInAt || 'Not Checked In'}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="gatekeeper_all_registrations.csv"');
      res.send(csv);
      return;
    }

    res.status(400).json({ error: 'Invalid export type. Must be users, events, or registrations.' });
  } catch (err: any) {
    console.error('Super Admin CSV export error:', err);
    res.status(500).json({ error: 'Export failed.' });
  }
});

export default router;
