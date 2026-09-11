import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { api } from '../api/apiClient.js';
import { RegistrationResponse } from '../../../shared/types.js';
import {
  TicketIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  DownloadIcon,
  MailIcon,
  SparklesIcon,
} from '../components/icons/CustomIcons.js';

interface PublicRegisterProps {
  eventId: string;
  onBackToDashboard?: () => void;
}

export const PublicRegister: React.FC<PublicRegisterProps> = ({ eventId, onBackToDashboard }) => {
  const [eventData, setEventData] = useState<any>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ticketType, setTicketType] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [ticketResult, setTicketResult] = useState<RegistrationResponse | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoadingEvent(true);
        const res = await api.getPublicEvent(eventId);
        setEventData(res.event);
      } catch (err: any) {
        setEventError(err.message || 'Failed to load event details.');
      } finally {
        setLoadingEvent(false);
      }
    };
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await api.registerAttendee({
        eventId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ticketType,
      });

      setTicketResult(res);

      // Trigger confetti celebration on ticket generation
      try {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#EC4899', '#10B981', '#F59E0B'],
        });
      } catch {
        // Confetti fallback
      }
    } catch (err: any) {
      setFormError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadQR = () => {
    if (!ticketResult?.attendee.qrDataUrl) return;
    const link = document.createElement('a');
    link.href = ticketResult.attendee.qrDataUrl;
    link.download = `${ticketResult.attendee.ticketCode}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading event details...</span>
        </div>
      </div>
    );
  }

  if (eventError || !eventData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="panel max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-signal-red/10 border border-signal-red/30 text-signal-red flex items-center justify-center mx-auto mb-4">
            <AlertTriangleIcon size={24} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Event Not Available</h2>
          <p className="text-sm text-gray-400 mb-6">{eventError || 'This event could not be found or is not open for registration.'}</p>
          {onBackToDashboard && (
            <button onClick={onBackToDashboard} className="btn-secondary text-sm">
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const capacityPct = Math.min(100, Math.round((eventData.registeredCount / eventData.capacity) * 100));
  const isNearCapacity = capacityPct >= 90 && !eventData.isSoldOut;
  const isSoldOut = eventData.isSoldOut || eventData.registeredCount >= eventData.capacity;

  return (
    <div className="min-h-screen bg-background text-gray-100 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      {/* Event Header Banner */}
      <div className="w-full max-w-xl text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/30 text-brand-cyan text-xs font-semibold uppercase tracking-wider mb-3">
          <SparklesIcon size={14} /> Official Registration
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
          {eventData.name}
        </h1>
        {eventData.description && (
          <p className="text-sm text-gray-300 max-w-lg mx-auto mb-4">{eventData.description}</p>
        )}

        {/* Event Meta Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-300">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-surface-border">
            <CalendarIcon size={14} className="text-brand-blue" />
            <span>{eventData.date}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-surface-border">
            <ClockIcon size={14} className="text-brand-blue" />
            <span>{eventData.startTime}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-surface-border">
            <MapPinIcon size={14} className="text-brand-blue" />
            <span>{eventData.venue}</span>
          </div>
        </div>
      </div>

      {/* Main Container: Registration Form OR Confirmation Ticket */}
      <div className="w-full max-w-xl">
        {!ticketResult ? (
          <div className="panel p-6 sm:p-8">
            {/* Capacity status bar */}
            <div className="mb-6 pb-6 border-b border-surface-border">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="text-gray-400 font-medium">Ticket Availability</span>
                <span className="font-semibold text-white">
                  {eventData.registeredCount} / {eventData.capacity} registered ({capacityPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-subtle overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isSoldOut
                      ? 'bg-signal-red'
                      : isNearCapacity
                      ? 'bg-signal-amber'
                      : 'bg-brand-blue'
                  }`}
                  style={{ width: `${capacityPct}%` }}
                />
              </div>

              {isNearCapacity && !isSoldOut && (
                <div className="mt-2.5 flex items-center gap-2 text-xs text-signal-amber">
                  <AlertTriangleIcon size={14} />
                  <span>Hurry! Limited tickets remaining (Over {capacityPct}% full)</span>
                </div>
              )}

              {isSoldOut && (
                <div className="mt-2.5 p-3 rounded-lg bg-signal-red/10 border border-signal-red/30 flex items-center gap-2 text-xs text-signal-red">
                  <AlertTriangleIcon size={16} />
                  <span className="font-semibold">Sold Out: This event has reached maximum capacity.</span>
                </div>
              )}
            </div>

            {formError && (
              <div className="mb-5 p-3.5 rounded-lg bg-signal-red/10 border border-signal-red/30 flex items-start gap-2.5 text-signal-red text-sm">
                <AlertTriangleIcon size={18} className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  disabled={isSoldOut || submitting}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  className="input-dark"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  disabled={isSoldOut || submitting}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. maya@example.com"
                  className="input-dark"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Already registered? Enter your email to retrieve your existing ticket.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">
                  Ticket Type
                </label>
                <select
                  disabled={isSoldOut || submitting}
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                  className="input-dark bg-surface-subtle"
                >
                  <option value="General">General Admission</option>
                  <option value="VIP">VIP Access</option>
                  <option value="Speaker">Speaker</option>
                  <option value="Staff">Staff</option>
                  <option value="Press">Press / Media</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSoldOut || submitting}
                className="w-full btn-primary py-3 mt-4 text-sm font-semibold tracking-wide"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating Ticket...</span>
                  </div>
                ) : isSoldOut ? (
                  'Registration Closed (Sold Out)'
                ) : (
                  'Get Ticket & QR Pass'
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Confirmation Ticket Card (scale-in animation) */
          <div className="panel p-6 sm:p-8 animate-scale-in border-brand-blue/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-blue" />

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-signal-green/10 border border-signal-green/30 text-signal-green mb-3">
                <CheckCircleIcon size={28} />
              </div>
              <h2 className="text-xl font-bold text-white">You're Confirmed!</h2>
              <p className="text-xs text-gray-400 mt-0.5">{ticketResult.message}</p>
            </div>

            {/* QR and Ticket Pass Card */}
            <div className="panel-subtle p-6 text-center mb-6 border border-surface-border">
              <div className="inline-block px-3 py-1 rounded-full bg-brand-blue/15 border border-brand-blue/30 text-brand-cyan text-xs font-semibold uppercase tracking-wider mb-4">
                {ticketResult.attendee.ticketType} Pass
              </div>

              {/* QR Code Container */}
              <div className="bg-white p-3.5 rounded-xl inline-block mx-auto mb-4">
                <img
                  src={ticketResult.attendee.qrDataUrl}
                  alt="Ticket QR Code"
                  className="w-48 h-48 sm:w-56 sm:h-56 block mx-auto"
                />
              </div>

              {/* Selectable Monospace Ticket Code */}
              <div className="bg-background border border-dashed border-gray-700 rounded-lg p-3 max-w-xs mx-auto mb-4">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                  Ticket Code (Manual Entry)
                </div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-brand-cyan tracking-wider select-all cursor-pointer">
                  {ticketResult.attendee.ticketCode}
                </div>
              </div>

              {/* Attendee Details Summary */}
              <div className="text-left text-xs space-y-2 max-w-xs mx-auto pt-2 border-t border-surface-border">
                <div className="flex justify-between">
                  <span className="text-gray-400">Attendee:</span>
                  <span className="font-semibold text-white">{ticketResult.attendee.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="font-mono text-gray-300">{ticketResult.attendee.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Venue:</span>
                  <span className="text-gray-300">{ticketResult.event.venue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Date & Time:</span>
                  <span className="text-gray-300">{ticketResult.event.date} at {ticketResult.event.startTime}</span>
                </div>
              </div>
            </div>

            {/* Email Notification Status */}
            <div className="p-3.5 rounded-lg bg-surface-subtle border border-surface-border text-xs flex items-center gap-2.5 text-gray-300 mb-6">
              <MailIcon size={16} className="text-brand-blue shrink-0" />
              <span>
                Ticket confirmation has been dispatched to <span className="font-mono text-white">{ticketResult.attendee.email}</span>.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownloadQR}
                className="flex-1 btn-primary py-2.5 text-xs font-semibold gap-2"
              >
                <DownloadIcon size={16} />
                <span>Save QR Image</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 btn-secondary py-2.5 text-xs font-semibold gap-2"
              >
                <TicketIcon size={16} />
                <span>Print Ticket</span>
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setTicketResult(null);
                  setName('');
                  setEmail('');
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Register another attendee
              </button>
            </div>
          </div>
        )}
      </div>

      {onBackToDashboard && (
        <div className="mt-8">
          <button onClick={onBackToDashboard} className="text-xs text-gray-400 hover:text-white transition-colors">
            &larr; Back to Organizer Dashboard
          </button>
        </div>
      )}
    </div>
  );
};
