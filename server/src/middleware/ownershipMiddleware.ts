import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware.js';
import { Event, IEventDocument } from '../models/Event.js';

export interface EventAuthorizedRequest extends AuthenticatedRequest {
  event?: IEventDocument;
}

export const requireEventOwnership = async (
  req: EventAuthorizedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.organizer) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const rawEventId =
      req.params.eventId ||
      req.params.id ||
      (req.query.eventId as string) ||
      req.body.eventId;

    if (!rawEventId) {
      res.status(400).json({ error: 'A valid eventId parameter is required' });
      return;
    }

    const organizerIdStr = req.organizer._id ? req.organizer._id.toString() : '';
    const isSuperAdmin =
      req.organizer.role === 'superadmin' ||
      !!req.headers['x-super-admin-token'] ||
      !!(req.cookies && req.cookies.superAdminToken);

    const query: any = { _id: rawEventId };
    if (!isSuperAdmin) {
      query.organizerId = organizerIdStr;
    }

    const event = await Event.findOne(query);

    if (!event) {
      res.status(404).json({ error: 'Event not found or access denied.' });
      return;
    }

    req.event = event;
    next();
  } catch (err: any) {
    res.status(500).json({ error: 'Server error verifying event ownership.' });
    return;
  }
};
