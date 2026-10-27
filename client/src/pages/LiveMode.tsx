import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import {
  ArrowLeft, Check, CloudOff, Flashlight, LogOut, Pause, Play, RefreshCw, Repeat,
  StopCircle, SwitchCamera, Ticket, Undo2, Volume2, VolumeX, X,
} from 'lucide-react';
import { api } from '../api/apiClient.js';
import { useOfflineSync } from '../context/OfflineSyncContext.js';
import { audioFeedback } from '../utils/audioFeedback.js';
import { IEvent, CheckInStatus } from '../../../shared/types.js';

interface LiveModeProps {
  eventId: string;
  onExit: () => void;
  onEventEnded: () => void;
}

interface ScanResultCard {
  status: CheckInStatus;
  message: string;
  attendeeName?: string;
  ticketType?: string;
  ticketCode?: string;
  checkInTime?: string;
  originalCheckInTime?: string;
  attendeeId?: string;
  scanId?: string;
}

const BRAND_ACCENT = 'brand-gradient text-white hover:brightness-110';
const field =
  'w-full rounded-xl border border-stone-200 bg-[#f4f7f6] px-3.5 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:outline-none';
const btnBrand = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${BRAND_ACCENT}`;
const btnDark =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-50';
const btnSoft =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#f0f3f2] px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-[#e6ebe9] disabled:opacity-50';
const panel = 'rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(20,30,25,0.04)]';

// High-contrast result colours: readable from arm's length at a busy door.
const resultStyle: Record<string, { label: string; bg: string; ring: string; icon: string }> = {
  VALID: { label: 'Checked in', bg: 'bg-[#b0e9c9]', ring: 'bg-emerald-700 text-white', icon: 'bg-emerald-100 text-emerald-800' },
  DUPLICATE: { label: 'Already scanned', bg: 'bg-amber-200', ring: 'bg-amber-600 text-white', icon: 'bg-amber-100 text-amber-800' },
  INVALID: { label: 'Invalid ticket', bg: 'bg-red-200', ring: 'bg-red-700 text-white', icon: 'bg-red-100 text-red-800' },
  QUEUED: { label: 'Saved offline', bg: 'bg-sky-200', ring: 'bg-sky-700 text-white', icon: 'bg-sky-100 text-sky-800' },
};

const StatusIcon: React.FC<{ status: string; size?: number }> = ({ status, size = 16 }) => {
  if (status === 'VALID') return <Check size={size} />;
  if (status === 'DUPLICATE') return <Repeat size={size} />;
  if (status === 'QUEUED') return <CloudOff size={size} />;
  return <X size={size} />;
};

export const LiveMode: React.FC<LiveModeProps> = ({ eventId, onExit, onEventEnded }) => {
  const { isOnline, pendingCount, isSyncing, lastSyncMessage, queueOfflineScan, syncNow, refreshCounts } =
    useOfflineSync();

  const [event, setEvent] = useState<IEvent | null>(null);
  const [stats, setStats] = useState({
    registeredCount: 0,
    checkedInCount: 0,
    attendanceRate: 0,
  });

  // Camera & scanner
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(true);

  // Rapid camera debounce tracking (2.5 seconds per code)
  const lastScannedCodeRef = useRef<{ code: string; timestamp: number } | null>(null);

  const [currentResult, setCurrentResult] = useState<ScanResultCard | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResultCard[]>([]);

  const [manualCode, setManualCode] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [showEndModal, setShowEndModal] = useState(false);
  const [endingEvent, setEndingEvent] = useState(false);
  const [showStopScanModal, setShowStopScanModal] = useState(false);

  const [errorToast, setErrorToast] = useState<string | null>(null);
  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4500);
  };

  const loadEventData = useCallback(async () => {
    try {
      const [evtRes, analyticsRes] = await Promise.all([
        api.getEvent(eventId),
        api.getEventAnalytics(eventId),
      ]);
      setEvent(evtRes.event);
      setStats({
        registeredCount: analyticsRes.analytics.registeredCount,
        checkedInCount: analyticsRes.analytics.checkedInCount,
        attendanceRate: analyticsRes.analytics.attendanceRate,
      });
    } catch (err) {
      console.error('Error loading live mode event data:', err);
    }
  }, [eventId]);

  useEffect(() => {
    loadEventData();
    refreshCounts(eventId);

    const interval = setInterval(() => {
      loadEventData();
      refreshCounts(eventId);
    }, 12000); // 12s live polling for statistics

    return () => clearInterval(interval);
  }, [loadEventData, refreshCounts, eventId]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioFeedback.enabled = next;
  };

  // Process a scanned code (camera or manual)
  const processCode = useCallback(
    async (rawCode: string, source: 'camera' | 'manual' = 'camera') => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();

      // Client-side 2.5s rapid camera duplicate suppression
      if (source === 'camera') {
        if (
          lastScannedCodeRef.current &&
          lastScannedCodeRef.current.code === code &&
          now - lastScannedCodeRef.current.timestamp < 2500
        ) {
          return;
        }
      }

      lastScannedCodeRef.current = { code, timestamp: now };

      // Case 1: device is offline
      if (!isOnline) {
        const offlineItem = await queueOfflineScan(eventId, code, source);
        const queuedCard: ScanResultCard = {
          status: 'QUEUED',
          message: 'No connection. Saved on this device and will sync when you are back online.',
          ticketCode: code,
          scanId: offlineItem.scanId,
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setCurrentResult(queuedCard);
        setRecentScans((prev) => [queuedCard, ...prev.slice(0, 19)]);
        return;
      }

      // Case 2: online, send to server
      try {
        const res = await api.checkInByCode(eventId, code, source);

        if (res.status === 'VALID') {
          audioFeedback.playSuccess();
          const validCard: ScanResultCard = {
            status: 'VALID',
            message: res.message || 'Check-in confirmed.',
            attendeeName: res.attendee?.name || 'Attendee',
            ticketType: res.attendee?.ticketType || 'General',
            ticketCode: res.attendee?.ticketCode || code,
            checkInTime: new Date(res.checkInTime || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            attendeeId: res.attendee?.id,
          };

          setCurrentResult(validCard);
          setRecentScans((prev) => [validCard, ...prev.slice(0, 19)]);

          setStats((prev) => {
            const nextCheckedIn = prev.checkedInCount + 1;
            const rate = prev.registeredCount > 0 ? Number(((nextCheckedIn / prev.registeredCount) * 100).toFixed(1)) : 100;
            return { ...prev, checkedInCount: nextCheckedIn, attendanceRate: rate };
          });
        } else if (res.status === 'DUPLICATE') {
          audioFeedback.playDuplicate();
          const origTime = res.attendee?.originalCheckedInAt
            ? new Date(res.attendee.originalCheckedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : undefined;

          const duplicateCard: ScanResultCard = {
            status: 'DUPLICATE',
            message: res.message || `Already checked in at ${origTime || 'an earlier time'}.`,
            attendeeName: res.attendee?.name || 'Attendee',
            ticketType: res.attendee?.ticketType || 'General',
            ticketCode: res.attendee?.ticketCode || code,
            originalCheckInTime: origTime,
            attendeeId: res.attendee?.id,
          };

          setCurrentResult(duplicateCard);
          setRecentScans((prev) => [duplicateCard, ...prev.slice(0, 19)]);
        } else {
          audioFeedback.playInvalid();
          const invalidCard: ScanResultCard = {
            status: 'INVALID',
            message: res.message || 'No registration matches this ticket for this event.',
            ticketCode: code,
          };

          setCurrentResult(invalidCard);
          setRecentScans((prev) => [invalidCard, ...prev.slice(0, 19)]);
        }
      } catch (err: any) {
        // Network error: queue it offline so nothing is lost
        console.warn('Network request failed, falling back to offline queue:', err);
        const offlineItem = await queueOfflineScan(eventId, code, source);
        const queuedCard: ScanResultCard = {
          status: 'QUEUED',
          message: 'Connection failed. Saved on this device and will sync later.',
          ticketCode: code,
          scanId: offlineItem.scanId,
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setCurrentResult(queuedCard);
        setRecentScans((prev) => [queuedCard, ...prev.slice(0, 19)]);
      }
    },
    [eventId, isOnline, queueOfflineScan]
  );

  const handleUndo = async (item: ScanResultCard) => {
    if (!item.attendeeId) return;

    try {
      await api.undoCheckIn(item.attendeeId, 'Organizer Undo from Live Mode Feed');
      setRecentScans((prev) => prev.filter((s) => s.attendeeId !== item.attendeeId));
      if (currentResult?.attendeeId === item.attendeeId) {
        setCurrentResult(null);
      }

      setStats((prev) => {
        const nextCheckedIn = Math.max(0, prev.checkedInCount - 1);
        const rate = prev.registeredCount > 0 ? Number(((nextCheckedIn / prev.registeredCount) * 100).toFixed(1)) : 0;
        return { ...prev, checkedInCount: nextCheckedIn, attendanceRate: rate };
      });
    } catch (err: any) {
      showError(`Couldn't undo: ${err.message}`);
    }
  };

  // Auto-dismiss result after 3.2 seconds
  useEffect(() => {
    if (currentResult) {
      const timer = setTimeout(() => {
        setCurrentResult(null);
      }, 3200);
      return () => clearTimeout(timer);
    }
  }, [currentResult]);

  // Camera initialization and cleanup
  useEffect(() => {
    let active = true;

    const stopCameraTracks = () => {
      try {
        controlsRef.current?.stop();
        controlsRef.current = null;
      } catch {}
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
          videoRef.current.srcObject = null;
        } catch {}
      }
      setTorchOn(false);
      setHasTorch(false);
    };

    const initScanner = async () => {
      if (!isScanning) {
        stopCameraTracks();
        return;
      }

      try {
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        if (!active) return;
        setVideoDevices(devices);

        // Default to the back camera if there is one
        let deviceToUse = selectedDeviceId;
        if (!deviceToUse && devices.length > 0) {
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          deviceToUse = backCam ? backCam.deviceId : devices[0].deviceId;
          setSelectedDeviceId(deviceToUse);
        }

        if (codeReaderRef.current) {
          controlsRef.current?.stop();
        }

        const codeReader = new BrowserQRCodeReader();
        codeReaderRef.current = codeReader;

        if (videoRef.current && isScanning) {
          const controls = await codeReader.decodeFromVideoDevice(
            deviceToUse,
            videoRef.current,
            (result, error) => {
              if (result && active) {
                processCode(result.getText(), 'camera');
              }
            }
          );
          controlsRef.current = controls;

          try {
            const track = (videoRef.current.srcObject as MediaStream)?.getVideoTracks()[0];
            const capabilities = (track as any)?.getCapabilities?.();
            if (capabilities && capabilities.torch) {
              setHasTorch(true);
            }
          } catch {
            setHasTorch(false);
          }
        }
      } catch (err) {
        console.warn('Camera access or initialization error:', err);
      }
    };

    initScanner();

    return () => {
      active = false;
      stopCameraTracks();
    };
  }, [selectedDeviceId, isScanning, processCode]);

  const handleSwitchCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setSelectedDeviceId(videoDevices[nextIndex].deviceId);
  };

  const handleToggleTorch = async () => {
    try {
      const track = (videoRef.current?.srcObject as MediaStream)?.getVideoTracks()[0];
      if (track && (track as any).applyConstraints) {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      }
    } catch (err) {
      console.warn('Torch control failed:', err);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || manualSubmitting) return;

    setManualSubmitting(true);
    try {
      await processCode(manualCode.trim(), 'manual');
      setManualCode('');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleEndEvent = async () => {
    setEndingEvent(true);
    try {
      await api.endEvent(eventId);
      setShowEndModal(false);
      onEventEnded();
    } catch (err: any) {
      setShowEndModal(false);
      showError(`Couldn't end the event: ${err.message}`);
    } finally {
      setEndingEvent(false);
    }
  };

  const pct = Math.min(100, Math.max(0, stats.attendanceRate));
  const rs = currentResult ? resultStyle[currentResult.status] || resultStyle.INVALID : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#f1f5f4] text-stone-900">
      {errorToast && (
        <div role="alert" className="fixed right-4 top-4 z-50 max-w-sm rounded-xl bg-red-700 px-4 py-3 text-sm text-white shadow-lg">
          {errorToast}
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onExit} className="rounded-xl bg-[#f0f3f2] p-2.5 text-stone-700 hover:bg-[#e6ebe9]" title="Back to dashboard" aria-label="Back to dashboard">
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold tracking-tight">{event?.name || 'Live check-in'}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Live
                </span>
              </div>
              <div className="truncate text-xs text-stone-500">
                {event?.venue}{event?.venue && event?.date ? ' · ' : ''}{event?.date}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${isOnline ? 'bg-[#f0f3f2] text-stone-700' : 'bg-amber-100 text-amber-900'}`}>
              {isOnline ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : <CloudOff size={14} />}
              {isOnline ? 'Online' : 'Offline'}
              {pendingCount > 0 && (
                <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">{pendingCount} waiting</span>
              )}
            </div>

            {pendingCount > 0 && (
              <button onClick={() => syncNow(eventId)} disabled={isSyncing || !isOnline} className={btnSoft} title="Send saved scans to the server now">
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            )}

            <button
              onClick={toggleSound}
              className="rounded-xl bg-[#f0f3f2] p-2.5 text-stone-700 hover:bg-[#e6ebe9]"
              title={soundEnabled ? 'Mute sounds' : 'Turn sounds on'}
              aria-label={soundEnabled ? 'Mute sounds' : 'Turn sounds on'}
            >
              {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} className="text-stone-400" />}
            </button>

            <button onClick={() => setShowStopScanModal(true)} className={btnSoft}>
              <StopCircle size={15} /> <span className="hidden sm:inline">Stop scanning</span>
            </button>

            <button onClick={() => setShowEndModal(true)} className={btnDark}>
              <LogOut size={14} /> <span className="hidden sm:inline">End event</span>
            </button>
          </div>
        </div>

        {lastSyncMessage && (
          <div className="mx-auto mt-2 max-w-7xl rounded-lg bg-sky-100 px-3 py-2 text-center text-sm text-sky-900">{lastSyncMessage}</div>
        )}
      </header>

      {/* Main */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-12">
        {/* Scanner column */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#b0e9c9] p-4">
              <p className="text-xs font-medium text-stone-700">Checked in</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{stats.checkedInCount}</p>
            </div>
            <div className="rounded-2xl bg-[#dcd7fb] p-4">
              <p className="text-xs font-medium text-stone-700">Registered</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{stats.registeredCount}</p>
            </div>
            <div className="rounded-2xl bg-[#c3dcfb] p-4">
              <p className="text-xs font-medium text-stone-700">Arrived</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{stats.attendanceRate}%</p>
            </div>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
          </div>

          {/* Camera */}
            <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-3xl bg-stone-900 sm:min-h-[440px]">
            <video
              ref={videoRef}
              className={`h-full w-full rounded-3xl object-cover ${!isScanning ? 'hidden' : ''}`}
              playsInline
              muted
              autoPlay
            />

            {isScanning ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative h-56 w-56 sm:h-64 sm:w-64">
                  <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-brand-coral" />
                  <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-brand-coral" />
                  <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-brand-coral" />
                  <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-brand-coral" />
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stone-900 p-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <Pause size={26} />
                </div>
                <h3 className="text-lg font-bold text-white">Scanner is paused</h3>
                <p className="mt-1 max-w-sm text-sm text-stone-400">
                  The camera is off. The event is still live, so you can pick up where you left off.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button onClick={() => setIsScanning(true)} className={btnBrand}>
                    <Play size={14} className="fill-current" /> Resume scanning
                  </button>
                  <button onClick={onExit} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20">
                    <ArrowLeft size={14} /> Back to dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Camera controls */}
            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-stone-900/85 px-4 py-2">
              {videoDevices.length > 1 && isScanning && (
                <button onClick={handleSwitchCamera} className="text-white/80 hover:text-white" title="Switch camera" aria-label="Switch camera">
                  <SwitchCamera size={20} />
                </button>
              )}
              {hasTorch && isScanning && (
                <button
                  onClick={handleToggleTorch}
                  className={torchOn ? 'text-brand-coral' : 'text-white/80 hover:text-white'}
                  title="Flashlight"
                  aria-label="Toggle flashlight"
                >
                  <Flashlight size={20} />
                </button>
              )}
              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${isScanning ? 'bg-white/15 text-white hover:bg-white/25' : BRAND_ACCENT}`}
              >
                {isScanning ? <><Pause size={12} className="fill-current" /> Pause</> : <><Play size={12} className="fill-current" /> Resume</>}
              </button>
            </div>

            {/* Result card */}
            {currentResult && rs && (
              <div className={`absolute inset-4 z-20 flex flex-col items-center justify-center rounded-2xl p-6 text-center ${rs.bg}`} role="status">
                <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full ${rs.ring}`}>
                  <StatusIcon status={currentResult.status} size={34} />
                </div>
                <div className="text-2xl font-bold tracking-tight">{rs.label}</div>

                {currentResult.attendeeName && (
                  <div className="mt-2 max-w-full break-words text-2xl font-bold sm:text-3xl">{currentResult.attendeeName}</div>
                )}
                {currentResult.ticketType && (
                  <div className="mt-2 rounded-full bg-white/70 px-3 py-1 text-sm font-medium">{currentResult.ticketType} pass</div>
                )}

                <p className="mt-3 max-w-sm text-sm text-stone-800">{currentResult.message}</p>

                {(currentResult.checkInTime || currentResult.originalCheckInTime) && (
                  <div className="mt-2 text-sm tabular-nums text-stone-700">
                    {currentResult.status === 'DUPLICATE' && currentResult.originalCheckInTime
                      ? `First scanned at ${currentResult.originalCheckInTime}`
                      : currentResult.checkInTime}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual entry */}
          <div className={panel}>
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Or type a ticket code, e.g. EVT-7K9M-4X2B"
                className={`${field} min-w-0 font-mono uppercase tracking-wide`}
                disabled={manualSubmitting}
                aria-label="Ticket code"
              />
              <button type="submit" disabled={!manualCode.trim() || manualSubmitting} className={`${btnBrand} shrink-0 px-5`}>
                {manualSubmitting ? 'Checking…' : 'Check in'}
              </button>
            </form>
          </div>
        </div>

        {/* Recent scans */}
        <div className="lg:col-span-5">
          <div className={`${panel} flex min-h-[480px] flex-col`}>
            <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="font-semibold">
                Recent scans <span className="ml-1 text-sm font-normal text-stone-400">{recentScans.length}</span>
              </h2>
              <span className="text-xs text-stone-400">This session</span>
            </div>

            <div className="max-h-[580px] flex-1 space-y-2 overflow-y-auto pr-1">
              {recentScans.length === 0 ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-8 text-center">
                  <Ticket size={28} className="mb-2 text-stone-300" />
                  <p className="text-sm font-medium text-stone-700">No scans yet</p>
                  <p className="mt-1 text-sm text-stone-500">Point the camera at a QR code, or type a ticket code.</p>
                </div>
              ) : (
                recentScans.map((scan, idx) => {
                  const st = resultStyle[scan.status] || resultStyle.INVALID;
                  return (
                    <div key={`${scan.ticketCode}-${idx}`} className="flex items-center justify-between gap-3 rounded-xl bg-[#f4f7f6] px-3.5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${st.icon}`}>
                          <StatusIcon status={scan.status} size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{scan.attendeeName || scan.ticketCode || 'Unknown ticket'}</div>
                          <div className="truncate text-xs text-stone-500">
                            {st.label}
                            {scan.ticketType ? ` · ${scan.ticketType}` : ''}
                            {' · '}
                            {scan.checkInTime || scan.originalCheckInTime || 'Just now'}
                          </div>
                        </div>
                      </div>

                      {scan.status === 'VALID' && scan.attendeeId && (
                        <button
                          onClick={() => handleUndo(scan)}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-red-700"
                          title="Undo this check-in"
                        >
                          <Undo2 size={12} /> Undo
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* End event */}
      {showEndModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => !endingEvent && setShowEndModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">End this event?</h3>
            <p className="mt-2 text-sm text-stone-600">
              Check-in will close, the event will be marked as ended, and you'll go to the summary. Scans saved offline should be synced first.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowEndModal(false)} disabled={endingEvent} className={btnSoft}>Keep it live</button>
              <button type="button" onClick={handleEndEvent} disabled={endingEvent} className="inline-flex items-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50">
                {endingEvent ? 'Ending…' : 'End event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop scanning */}
      {showStopScanModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => setShowStopScanModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Stop scanning?</h3>
            <p className="mt-2 text-sm text-stone-600">
              The camera turns off. The event stays live, so you or someone else at the gate can start scanning again any time.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowStopScanModal(false)} className={`${btnSoft} sm:order-1`}>Cancel</button>
              <button
                type="button"
                onClick={() => { setIsScanning(false); setShowStopScanModal(false); }}
                className={`${btnSoft} sm:order-2`}
              >
                <Pause size={13} className="fill-current" /> Pause here
              </button>
              <button
                type="button"
                onClick={() => { setIsScanning(false); setShowStopScanModal(false); onExit(); }}
                className={`${btnDark} sm:order-3`}
              >
                Stop and go to dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};