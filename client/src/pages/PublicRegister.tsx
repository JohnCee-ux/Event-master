import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { api } from '../api/apiClient.js';
import { RegistrationResponse } from '../../../shared/types.js';
import {
  TicketIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  DownloadIcon,
  MailIcon,
  SparklesIcon,
  SearchIcon,
  QrCodeIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '../components/icons/CustomIcons.js';
import { BrandLogo } from '../components/BrandLogo.js';

interface PublicRegisterProps {
  eventId?: string;
  onSelectEvent?: (eventId: string) => void;
  onBackToDashboard?: () => void;
}

export const PublicRegister: React.FC<PublicRegisterProps> = ({
  eventId: initialEventId = '',
  onSelectEvent,
  onBackToDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'register' | 'lookup'>('register');
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);
  const [eventData, setEventData] = useState<any>(null);
  const [publicEvents, setPublicEvents] = useState<any[]>([]);
  const [loadingEventsList, setLoadingEventsList] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // Registration Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ticketType, setTicketType] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ticket Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Result state
  const [ticketResult, setTicketResult] = useState<RegistrationResponse | null>(null);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [directEventInput, setDirectEventInput] = useState('');

  // Sync initialEventId if prop updates
  useEffect(() => {
    if (initialEventId) {
      setSelectedEventId(initialEventId);
    }
  }, [initialEventId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Load public events list
  useEffect(() => {
    const fetchPublicEvents = async () => {
      try {
        setLoadingEventsList(true);
        setEventError(null);
        const res = await api.getPublicEvents();
        setPublicEvents(res.events || []);
        if (!selectedEventId && res.events && res.events.length > 0) {
          setSelectedEventId(res.events[0].id);
          if (onSelectEvent) onSelectEvent(res.events[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load public events:', err);
        setPublicEvents([]);
        setEventError(err.message || 'Unable to load published events. Please try again.');
      } finally {
        setLoadingEventsList(false);
      }
    };
    fetchPublicEvents();
  }, []);

  // Fetch details for selected event
  useEffect(() => {
    if (!selectedEventId) {
      setEventData(null);
      return;
    }
    const fetchEvent = async () => {
      try {
        setLoadingEvent(true);
        setEventError(null);
        const res = await api.getPublicEvent(selectedEventId);
        setEventData(res.event);
      } catch (err: any) {
        setEventError(err.message || 'Failed to load event details.');
      } finally {
        setLoadingEvent(false);
      }
    };
    fetchEvent();
  }, [selectedEventId]);

  // Handle registration submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      setFormError('Please choose an event first.');
      return;
    }
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await api.registerAttendee({
        eventId: selectedEventId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ticketType,
      });

      setTicketResult(res);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3861FB', '#6366F1', '#10B981', '#38BDF8'],
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

  // Handle ticket retrieval lookup
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = lookupQuery.trim();
    if (!query) {
      setLookupError('Please enter your email or ticket code.');
      return;
    }

    setLookupError(null);
    setLookupLoading(true);

    try {
      const isEmail = query.includes('@');
      const res = await api.publicLookupTicket({
        email: isEmail ? query.toLowerCase() : undefined,
        ticketCode: isEmail ? undefined : query.toUpperCase(),
        eventId: selectedEventId || undefined,
      });
      setTicketResult(res);
    } catch (err: any) {
      setLookupError(err.message || 'No ticket found with those credentials.');
    } finally {
      setLookupLoading(false);
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

  const handlePrint = () => window.print();

  const handleDirectEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = directEventInput.trim();
    if (!value) return;

    let eventId = value;
    try {
      const url = new URL(value);
      eventId = url.searchParams.get('eventId') || url.searchParams.get('event') || value;
    } catch {
      // Treat non-URL input as a direct event code or ID.
    }

    setEventError(null);
    setSelectedEventId(eventId);
    if (onSelectEvent) onSelectEvent(eventId);
  };

  const filteredEvents = publicEvents.filter(
    (evt) =>
      evt.name.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
      evt.venue.toLowerCase().includes(eventSearchQuery.toLowerCase())
  );

  return (
    <div className="page-shell public-register-shell min-h-screen text-slate-200 font-sans py-4 sm:py-5 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start relative overflow-x-hidden selection:bg-brand-purple/30 selection:text-white">
      {/* Background glow accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-purple/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-coral/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <div className={`public-register-header  max-w-2xl flex items-center justify-between ${ticketResult ? 'mb-2 sm:mb-2.5' : 'mb-3 sm:mb-4'} z-10`}>
        <div className="flex items-center gap-2.5">
          <BrandLogo className="public-register-brand-icon h-8 w-8 rounded-xl shadow-md shadow-brand-purple/20 sm:h-9 sm:w-9" />
          <div>
            <span className="font-display font-bold text-base sm:text-lg text-white block tracking-tight leading-tight">Event Hub</span>
            <span className="public-register-kicker">Secure event access</span>
          </div>
        </div>

        {onBackToDashboard && (
          <button onClick={onBackToDashboard} className="public-register-secondary-action px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors flex items-center gap-1.5">
            <ArrowLeftIcon size={13} /> Back to Dashboard
          </button>
        )}
      </div>

      {/* Main Container Subtitle (shown during selection/registration) */}
      {!ticketResult && (
        <div className="public-register-intro w-full max-w-2xl z-10 text-center mb-3 sm:mb-4">
          <div className="public-register-eyebrow">Your next experience starts here</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">Find your event. <span>Get your pass.</span></h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-lg mx-auto">Choose an event or use the invitation link from your organizer to register in seconds.</p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1.5">
            <MailIcon size={12} className="text-brand-purple-hi shrink-0" />
            <span>Check your email or SMS for your personalized invite link or event code</span>
          </p>
        </div>
      )}

      <div className="w-full max-w-2xl z-10 public-register-card">
        {ticketResult ? (
          <div className="bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_0.4s_ease-out]">
            <div className="bg-gradient-to-r from-brand-purple to-brand-coral h-1.5" />
            
            <div className="p-4 sm:p-5 text-center border-b border-white/5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 shadow-md shadow-emerald-500/10">
                <CheckCircleIcon size={22} />
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-1">Your Ticket is Ready!</h2>
              <p className="text-xs sm:text-sm text-slate-400">{ticketResult.message || 'Present this QR code at the door for entry.'}</p>
            </div>

            <div className="p-4 sm:p-6 bg-slate-950/50 flex flex-col items-center relative">
              {/* Ticket Notch cutouts (aesthetic) */}
              <div className="absolute top-0 left-0 w-3.5 h-3.5 bg-slate-900 rounded-br-lg" />
              <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-slate-900 rounded-bl-lg" />

              <div className="inline-block px-3 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple-hi text-[11px] font-bold uppercase tracking-widest mb-3 sm:mb-4">
                {ticketResult.attendee.ticketType || 'General'} Pass
              </div>

              {/* QR Code */}
              <div className="bg-white p-2.5 sm:p-3 rounded-2xl mb-3 sm:mb-4 shadow-xl relative">
                <img src={ticketResult.attendee.qrDataUrl} alt="Ticket QR Code" className="w-32 h-32 sm:w-40 sm:h-40 block" />
              </div>

              {/* Monospace Code */}
              <div className="border border-dashed border-white/20 rounded-xl py-2 px-3 w-full max-w-xs text-center mb-3 sm:mb-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">Ticket Code</div>
                <div className="font-mono text-base sm:text-lg font-bold text-white tracking-widest select-all">{ticketResult.attendee.ticketCode}</div>
              </div>

              {/* Details */}
              <div className="w-full max-w-sm space-y-2 text-xs sm:text-sm pt-2.5 sm:pt-3 border-t border-white/10">
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-500">Event</span>
                  <span className="font-bold text-white text-right max-w-[180px] truncate">{ticketResult.event.name}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-500">Attendee</span>
                  <span className="font-bold text-white">{ticketResult.attendee.name}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-500">Venue</span>
                  <span className="text-slate-300">{ticketResult.event.venue}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-500">Time</span>
                  <span className="text-slate-300">{ticketResult.event.date} at {ticketResult.event.startTime}</span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900 border-t border-white/5 space-y-3">
              <div className="p-2.5 sm:p-3 rounded-xl bg-brand-purple/5 border border-brand-purple/10 text-xs flex items-start gap-2.5 text-slate-400">
                <MailIcon size={16} className="text-brand-purple-hi shrink-0 mt-0.5" />
                <span>
                  {ticketResult.attendee.emailSent
                    ? <>Ticket copy successfully emailed to <span className="font-mono text-white">{ticketResult.attendee.email}</span>.</>
                    : <>Ticket email is delivering to <span className="font-mono text-white">{ticketResult.attendee.email}</span>. Save this QR as backup.</>}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button onClick={handleDownloadQR} className="flex-1 py-2.5 sm:py-3 rounded-xl bg-brand-purple hover:bg-brand-purple/90 font-bold text-white shadow-lg shadow-brand-purple/25 flex items-center justify-center gap-2 transition-all text-xs sm:text-sm">
                  <DownloadIcon size={16} /> Save QR Image
                </button>
                <button onClick={handlePrint} className="flex-1 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-slate-200 flex items-center justify-center gap-2 transition-colors text-xs sm:text-sm">
                  <TicketIcon size={16} /> Print Pass
                </button>
              </div>

              <div className="pt-1 text-center">
                <button onClick={() => { setTicketResult(null); setName(''); setEmail(''); }} className="text-xs font-semibold text-brand-purple-hi hover:underline transition-colors">
                  Register another attendee
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden">
            
            {/* Tabs */}
            <div className="public-register-tabs flex border-b border-white/5 bg-slate-950/80 p-1 sm:p-1.5 gap-1.5">
              <button
                onClick={() => setActiveTab('register')}
                className={`public-tab-btn flex-1 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'register'
                    ? 'tab-active-primary bg-brand-purple text-white border-brand-purple shadow-lg shadow-brand-purple/30 font-extrabold'
                    : 'tab-inactive-secondary bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <SparklesIcon size={15} /> Get Ticket
              </button>
              <button
                onClick={() => setActiveTab('lookup')}
                className={`public-tab-btn flex-1 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold border transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'lookup'
                    ? 'tab-active-secondary bg-white/10 text-white border-brand-purple/60 shadow-md shadow-brand-purple/10 font-bold'
                    : 'tab-inactive-secondary bg-transparent border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <SearchIcon size={15} /> Find My QR
              </button>
            </div>

            <div className="p-4 sm:p-5">
              {/* Event Picker / Selected State */}
              {activeTab === 'register' && (selectedEventId && eventData ? (
                <div className="mb-4 sm:mb-5 p-3.5 sm:p-4 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-3 shadow-inner">
                  <div className="min-w-0 flex-1">
                    {eventData.imageDataUrl && (
                      <img src={eventData.imageDataUrl} alt={`${eventData.name} event graphic`} className="mb-2.5 h-20 sm:h-24 w-full rounded-lg object-cover border border-white/10" />
                    )}
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-purple-hi mb-1 flex items-center gap-1.5">
                      <SparklesIcon size={12} /> Event Selected
                    </div>
                    <h3 className="text-base sm:text-lg font-display font-bold text-white leading-tight">{eventData.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1.5">
                      <span>{eventData.date}</span>
                      <span className="text-white/20">•</span>
                      <span>{eventData.startTime}</span>
                      <span className="text-white/20">•</span>
                      <span>{eventData.venue}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedEventId(''); setEventData(null); }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : activeTab === 'register' ? (
                <div className="mb-4 sm:mb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
                      <span>Select Upcoming Event</span>
                    </h3>
                    {loadingEventsList ? (
                      <span className="px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple-hi text-[10px] font-bold tracking-wider animate-pulse">Checking...</span>
                    ) : publicEvents.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple-hi text-[10px] font-bold uppercase tracking-wider">{publicEvents.length} open</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">0 public</span>
                    )}
                  </div>

                  {publicEvents.length > 3 && (
                    <div className="relative mb-3">
                      <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search events or venues..."
                        value={eventSearchQuery}
                        onChange={(e) => setEventSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all text-xs sm:text-sm"
                      />
                    </div>
                  )}

                  {loadingEventsList ? (
                    <div className="space-y-2.5 py-1">
                      {[1, 2].map((idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 animate-pulse flex items-center justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-white/10 rounded w-2/5"></div>
                            <div className="h-3 bg-white/5 rounded w-3/5"></div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-white/5 shrink-0"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredEvents.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1.5 custom-scrollbar">
                      {filteredEvents.map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => {
                            setSelectedEventId(evt.id);
                            if (onSelectEvent) onSelectEvent(evt.id);
                          }}
                          className="p-3 sm:p-3.5 rounded-xl bg-slate-950 border border-white/5 hover:border-brand-purple/50 hover:bg-white/5 cursor-pointer transition-all flex items-center justify-between group"
                        >
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-brand-purple-hi transition-colors mb-0.5">
                              {evt.name}
                            </h4>
                            <div className="text-xs text-slate-400 flex items-center gap-2">
                              <span>{evt.date}</span>
                              <span className="text-white/20">•</span>
                              <span>{evt.venue}</span>
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-brand-purple/10 text-brand-purple-hi flex items-center justify-center group-hover:bg-brand-purple group-hover:text-white transition-all">
                            <ArrowRightIcon size={13} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-dashed border-white/15 text-center">
                      <div className="w-10 h-10 mx-auto mb-2.5 rounded-xl bg-brand-purple/10 border border-brand-purple/20 text-brand-purple-hi flex items-center justify-center">
                        <TicketIcon size={18} />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white mb-0.5">No active public events right now</h4>
                      <p className="text-[11px] sm:text-xs text-slate-400 mb-3 max-w-sm mx-auto">Use your invitation link or enter your event code below to access private registration.</p>
                      <form onSubmit={handleDirectEventSubmit} className="flex flex-col sm:flex-row gap-2 text-left max-w-md mx-auto">
                        <input
                          type="text"
                          value={directEventInput}
                          onChange={(e) => setDirectEventInput(e.target.value)}
                          placeholder="Paste event code or invitation URL"
                          aria-label="Event code or invitation URL"
                          className="min-w-0 flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all text-xs sm:text-sm"
                        />
                        <button type="submit" className="px-3.5 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple/90 font-bold text-white flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm whitespace-nowrap">
                          Continue <ArrowRightIcon size={14} />
                        </button>
                      </form>
                      {eventError && <p className="text-xs text-red-400 mt-2 text-left">{eventError}</p>}
                    </div>
                  )}
                </div>
              ) : null)}

              {/* REGISTER TAB */}
              {activeTab === 'register' && selectedEventId && eventData && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                  <div className="mb-6 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Availability</span>
                      <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-full">{eventData.registeredCount} / {eventData.capacity} filled</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${eventData.isSoldOut ? 'bg-red-500' : 'bg-brand-purple'}`}
                        style={{ width: `${Math.min(100, Math.round((eventData.registeredCount / eventData.capacity) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {formError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                      <AlertTriangleIcon size={18} className="shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Full Name</label>
                      <input
                        type="text"
                        required
                        disabled={eventData.isSoldOut || submitting}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
                      <input
                        type="email"
                        required
                        disabled={eventData.isSoldOut || submitting}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@example.com"
                        className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Pass Type</label>
                      <select
                        disabled={eventData.isSoldOut || submitting}
                        value={ticketType}
                        onChange={(e) => setTicketType(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all appearance-none"
                      >
                        <option value="General">General Admission</option>
                        <option value="VIP">VIP Access</option>
                        <option value="Speaker">Speaker</option>
                        <option value="Media">Media / Press</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={eventData.isSoldOut || submitting}
                      className="w-full py-4 rounded-xl bg-brand-purple hover:bg-brand-purple/90 font-bold text-white shadow-lg shadow-brand-purple/25 flex items-center justify-center gap-2 mt-2 transition-all"
                    >
                      {submitting ? (
                        <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating QR...</>
                      ) : eventData.isSoldOut ? (
                        'Event Sold Out'
                      ) : (
                        <><QrCodeIcon size={18} /> Register & Get QR Pass</>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* LOOKUP TAB */}
              {activeTab === 'lookup' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                  <p className="text-sm text-slate-400 mb-6">
                    Enter the email address you used to register or your Ticket Code to retrieve your pass.
                  </p>

                  {lookupError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                      <AlertTriangleIcon size={18} className="shrink-0 mt-0.5" />
                      <span>{lookupError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLookup} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Email Address or Ticket Code</label>
                      <input
                        type="text"
                        value={lookupQuery}
                        onChange={(e) => setLookupQuery(e.target.value)}
                        placeholder="you@example.com or EVT-XXXX-XXX"
                        aria-label="Email Address or Ticket Code"
                        className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="w-full py-4 rounded-xl bg-brand-purple hover:bg-brand-purple/90 font-bold text-white shadow-lg shadow-brand-purple/25 flex items-center justify-center gap-2 mt-2 transition-all"
                    >
                      {lookupLoading ? (
                        <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching...</>
                      ) : (
                        <><SearchIcon size={18} /> Retrieve Ticket</>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-xs font-bold tracking-wider uppercase text-slate-600 z-10">
        Powered by GateKeeper
      </div>
    </div>
  );
};
