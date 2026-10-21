import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Pause, Play, StopCircle } from 'lucide-react';
import { api } from '../api/apiClient.js';
import { useOfflineSync } from '../context/OfflineSyncContext.js';
import { audioFeedback } from '../utils/audioFeedback.js';
import { IEvent, CheckInStatus, IOfflineScan } from '../../../shared/types.js';
import {
  CheckIcon,
  XMarkIcon,
  RepeatIcon,
  CloudOfflineIcon,
  CloudSyncIcon,
  CameraIcon,
  CameraSwitchIcon,
  FlashlightIcon,
  SoundOnIcon,
  SoundOffIcon,
  UndoIcon,
  ArrowLeftIcon,
  LogOutIcon,
  TicketIcon,
  UsersIcon,
  ClockIcon,
  SparklesIcon,
} from '../components/icons/CustomIcons.js';

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

export const LiveMode: React.FC<LiveModeProps> = ({ eventId, onExit, onEventEnded }) => {
  const { isOnline, pendingCount, syncedCount, isSyncing, lastSyncMessage, queueOfflineScan, syncNow, refreshCounts } =
    useOfflineSync();

  const [event, setEvent] = useState<IEvent | null>(null);
  const [stats, setStats] = useState({
    registeredCount: 0,
    checkedInCount: 0,
    attendanceRate: 0,
  });

  // Camera & Scanner State
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

  // Result state
  const [currentResult, setCurrentResult] = useState<ScanResultCard | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResultCard[]>([]);

  // Manual Code Input
  const [manualCode, setManualCode] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // End Event Modal State
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingEvent, setEndingEvent] = useState(false);

  // Stop Live Scan Modal State
  const [showStopScanModal, setShowStopScanModal] = useState(false);

  // Fetch Event & Live Analytics
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

  // Audio preference toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioFeedback.enabled = next;
  };

  // Process a scanned code (via camera or manual input)
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
          // Ignore repeated camera frames within debounce window silently
          return;
        }
      }

      lastScannedCodeRef.current = { code, timestamp: now };

      // Case 1: Device is OFFLINE
      if (!isOnline) {
        const offlineItem = await queueOfflineScan(eventId, code, source);
        const queuedCard: ScanResultCard = {
          status: 'QUEUED',
          message: 'Saved to local queue. Will sync automatically when back online.',
          ticketCode: code,
          scanId: offlineItem.scanId,
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setCurrentResult(queuedCard);
        setRecentScans((prev) => [queuedCard, ...prev.slice(0, 19)]);
        return;
      }

      // Case 2: ONLINE - Send to server
      try {
        const res = await api.checkInByCode(eventId, code, source);

        if (res.status === 'VALID') {
          audioFeedback.playSuccess();
          const validCard: ScanResultCard = {
            status: 'VALID',
            message: res.message || 'Check-in confirmed!',
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

          // Increment local stats immediately
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
            message: res.message || `Already checked in at ${origTime || 'earlier'}`,
            attendeeName: res.attendee?.name || 'Attendee',
            ticketType: res.attendee?.ticketType || 'General',
            ticketCode: res.attendee?.ticketCode || code,
            originalCheckInTime: origTime,
            attendeeId: res.attendee?.id,
          };

          setCurrentResult(duplicateCard);
          setRecentScans((prev) => [duplicateCard, ...prev.slice(0, 19)]);
        } else {
          // INVALID
          audioFeedback.playInvalid();
          const invalidCard: ScanResultCard = {
            status: 'INVALID',
            message: res.message || 'Invalid Ticket: No matching registration for this event.',
            ticketCode: code,
          };

          setCurrentResult(invalidCard);
          setRecentScans((prev) => [invalidCard, ...prev.slice(0, 19)]);
        }
      } catch (err: any) {
        // Network error during attempt -> queue offline safely
        console.warn('Network request failed, falling back to offline queue:', err);
        const offlineItem = await queueOfflineScan(eventId, code, source);
        const queuedCard: ScanResultCard = {
          status: 'QUEUED',
          message: 'Connection failed. Saved to offline queue.',
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

  // Undo Check-in action
  const handleUndo = async (item: ScanResultCard) => {
    if (!item.attendeeId) return;

    try {
      await api.undoCheckIn(item.attendeeId, 'Organizer Undo from Live Mode Feed');
      // Remove or update the item in recent scans
      setRecentScans((prev) => prev.filter((s) => s.attendeeId !== item.attendeeId));
      if (currentResult?.attendeeId === item.attendeeId) {
        setCurrentResult(null);
      }

      // Decrement stats
      setStats((prev) => {
        const nextCheckedIn = Math.max(0, prev.checkedInCount - 1);
        const rate = prev.registeredCount > 0 ? Number(((nextCheckedIn / prev.registeredCount) * 100).toFixed(1)) : 0;
        return { ...prev, checkedInCount: nextCheckedIn, attendanceRate: rate };
      });
    } catch (err: any) {
      alert(`Undo failed: ${err.message}`);
    }
  };

  // Auto-dismiss current result banner after 3.2 seconds
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

        // Default to environment / back camera if available
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

          // Check if torch/flashlight is supported
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

  // Switch camera toggle
  const handleSwitchCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setSelectedDeviceId(videoDevices[nextIndex].deviceId);
  };

  // Flashlight toggle
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

  // Manual Code Submit
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

  // End Event action
  const handleEndEvent = async () => {
    setEndingEvent(true);
    try {
      await api.endEvent(eventId);
      setShowEndModal(false);
      onEventEnded();
    } catch (err: any) {
      alert(`Failed to end event: ${err.message}`);
    } finally {
      setEndingEvent(false);
    }
  };

  return (
    <div className="page-shell text-gray-100 flex flex-col">
      {/* Top Operational Bar */}
      <header className="bg-[#060918]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Exit & Event Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-surface-subtle border border-surface-border text-gray-300 hover:text-white hover:bg-surface-card transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight">{event?.name || 'Event Live Mode'}</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-signal-green/15 border border-signal-green/30 text-signal-green text-[11px] font-semibold uppercase tracking-wider animate-pulse-subtle">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-ping" />
                  Live Mode
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                <span>{event?.venue}</span>
                <span>&bull;</span>
                <span>{event?.date}</span>
              </div>
            </div>
          </div>

          {/* Center/Right: Network Status, Pending Queue & End Event */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Network / Offline Queue Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                isOnline
                  ? 'bg-surface-subtle border-surface-border text-gray-300'
                  : 'bg-signal-amber/15 border-signal-amber/40 text-signal-amber'
              }`}
            >
              {isOnline ? (
                <div className="w-2 h-2 rounded-full bg-signal-green" />
              ) : (
                <CloudOfflineIcon size={14} className="text-signal-amber" />
              )}
              <span>{isOnline ? 'Online' : 'Offline'}</span>

              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-signal-amber text-black font-bold text-[10px]">
                  {pendingCount} Pending
                </span>
              )}
            </div>

            {/* Sync trigger if pending items exist */}
            {pendingCount > 0 && (
              <button
                onClick={() => syncNow(eventId)}
                disabled={isSyncing || !isOnline}
                className="btn-amber px-2.5 py-1.5 text-xs gap-1.5"
                title="Sync offline scans now"
              >
                <CloudSyncIcon size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'bg-surface-subtle border-surface-border text-brand-blue hover:text-blue-400'
                  : 'bg-surface-subtle border-surface-border text-gray-500 hover:text-gray-400'
              }`}
              title={soundEnabled ? 'Mute audio tones' : 'Enable audio tones'}
            >
              {soundEnabled ? <SoundOnIcon size={18} /> : <SoundOffIcon size={18} />}
            </button>

            {/* Stop Live Scan Button */}
            <button
              onClick={() => setShowStopScanModal(true)}
              className="btn-amber px-3 py-1.5 text-xs font-semibold gap-1.5 shadow-sm"
              title="Stop live scanning session"
            >
              <StopCircle size={15} />
              <span className="hidden sm:inline">Stop Live Scan</span>
            </button>

            {/* End Event Button */}
            <button
              onClick={() => setShowEndModal(true)}
              className="btn-danger px-3 py-1.5 text-xs font-semibold gap-1.5"
            >
              <LogOutIcon size={14} />
              <span className="hidden sm:inline">End Event</span>
            </button>
          </div>
        </div>

        {/* Sync message banner */}
        {lastSyncMessage && (
          <div className="max-w-7xl mx-auto mt-2 p-2 rounded bg-surface-subtle border border-brand-blue/30 text-xs text-brand-cyan text-center">
            {lastSyncMessage}
          </div>
        )}
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Center Column (7 cols): Camera Viewport & Manual Code Entry */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Real-time Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="panel p-3 text-center sm:col-span-2">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">Checked In</div>
              <div className="text-2xl font-bold text-signal-green font-mono">{stats.checkedInCount}</div>
            </div>
            <div className="panel p-3 text-center sm:col-span-1">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">Registered</div>
              <div className="text-2xl font-bold text-white font-mono">{stats.registeredCount}</div>
            </div>
            <div className="panel p-3 text-center sm:col-span-1">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-0.5">Attendance</div>
              <div className="text-2xl font-bold text-brand-cyan font-mono">{stats.attendanceRate}%</div>
            </div>
          </div>

          {/* Scanner Viewport Container */}
          <div className="panel p-3 relative overflow-hidden bg-black flex flex-col items-center justify-center min-h-[360px] sm:min-h-[420px] rounded-2xl border-2 border-surface-border">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover rounded-xl ${!isScanning ? 'hidden' : ''}`}
              playsInline
              muted
              autoPlay
            />

            {/* Viewfinder Overlay (when active) or Paused Screen (when stopped) */}
            {isScanning ? (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="w-56 h-56 sm:w-64 sm:h-64 relative border-2 border-transparent">
                  {/* 4 Corner Brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-blue rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-blue rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-blue rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-blue rounded-br-lg" />

                  {/* Animated Scan Line */}
                  <div className="w-full h-0.5 bg-brand-cyan animate-scan-line absolute top-1/2" />
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 backdrop-blur-sm z-10 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
                  <Pause size={28} />
                </div>
                <div className="inline-block px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                  Scanner Stopped
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Live Camera Deactivated</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-6">
                  QR decoding is paused and camera hardware is released. You can resume scanning or return to the dashboard.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setIsScanning(true)}
                    className="btn-primary px-5 py-2.5 text-xs font-bold gap-2 shadow-lg shadow-brand-purple/30"
                  >
                    <Play size={14} className="fill-current" />
                    Resume Live Scan
                  </button>
                  <button
                    onClick={onExit}
                    className="btn-glass px-4 py-2.5 text-xs font-semibold gap-1.5"
                  >
                    <ArrowLeftIcon size={14} />
                    Exit to Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Camera Floating Controls (bottom glass overlay) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-full flex items-center gap-4 z-20">
              {videoDevices.length > 1 && isScanning && (
                <button
                  onClick={handleSwitchCamera}
                  className="text-gray-300 hover:text-white transition-colors"
                  title="Switch Camera (Front/Rear)"
                >
                  <CameraSwitchIcon size={20} />
                </button>
              )}
              {hasTorch && isScanning && (
                <button
                  onClick={handleToggleTorch}
                  className={`transition-colors ${torchOn ? 'text-signal-yellow' : 'text-gray-300 hover:text-white'}`}
                  title="Toggle Flashlight"
                >
                  <FlashlightIcon size={20} />
                </button>
              )}
              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
                  isScanning
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {isScanning ? (
                  <>
                    <Pause size={12} className="fill-current" />
                    <span>Stop Scan</span>
                  </>
                ) : (
                  <>
                    <Play size={12} className="fill-current" />
                    <span>Resume Scan</span>
                  </>
                )}
              </button>
            </div>

            {/* Result Overlay State (Glass overlay shown over camera feed) */}
            {currentResult && (
              <div
                className={`absolute inset-4 rounded-xl glass-panel p-6 flex flex-col items-center justify-center text-center animate-scale-in z-20 ${
                  currentResult.status === 'VALID'
                    ? 'border-signal-green/60 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
                    : currentResult.status === 'DUPLICATE'
                    ? 'border-signal-amber/60 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                    : currentResult.status === 'QUEUED'
                    ? 'border-brand-blue/60 shadow-[0_0_30px_rgba(59,130,246,0.25)]'
                    : 'border-signal-red/60 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
                }`}
              >
                {/* Icon & Status Label */}
                <div className="mb-3">
                  {currentResult.status === 'VALID' && (
                    <div className="w-16 h-16 rounded-full bg-signal-green/20 border-2 border-signal-green text-signal-green flex items-center justify-center mx-auto mb-2">
                      <CheckIcon size={36} />
                    </div>
                  )}
                  {currentResult.status === 'DUPLICATE' && (
                    <div className="w-16 h-16 rounded-full bg-signal-amber/20 border-2 border-signal-amber text-signal-amber flex items-center justify-center mx-auto mb-2">
                      <RepeatIcon size={36} />
                    </div>
                  )}
                  {currentResult.status === 'INVALID' && (
                    <div className="w-16 h-16 rounded-full bg-signal-red/20 border-2 border-signal-red text-signal-red flex items-center justify-center mx-auto mb-2">
                      <XMarkIcon size={36} />
                    </div>
                  )}
                  {currentResult.status === 'QUEUED' && (
                    <div className="w-16 h-16 rounded-full bg-brand-blue/20 border-2 border-brand-blue text-brand-cyan flex items-center justify-center mx-auto mb-2">
                      <CloudOfflineIcon size={36} />
                    </div>
                  )}

                  <div
                    className={`text-2xl font-bold tracking-wider uppercase font-display ${
                      currentResult.status === 'VALID'
                        ? 'text-signal-green'
                        : currentResult.status === 'DUPLICATE'
                        ? 'text-signal-amber'
                        : currentResult.status === 'QUEUED'
                        ? 'text-brand-cyan'
                        : 'text-signal-red'
                    }`}
                  >
                    {currentResult.status}
                  </div>
                </div>

                {/* Attendee Name on Success / Duplicate */}
                {currentResult.attendeeName && (
                  <div className="text-xl sm:text-2xl font-bold text-white mb-1">
                    {currentResult.attendeeName}
                  </div>
                )}

                {/* Ticket Type & Code */}
                {currentResult.ticketType && (
                  <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-semibold uppercase text-gray-200 mb-2">
                    {currentResult.ticketType} Pass
                  </div>
                )}

                {/* Timestamp or Reason Message */}
                <p className="text-xs sm:text-sm text-gray-300 max-w-sm">
                  {currentResult.message}
                </p>

                {currentResult.checkInTime && (
                  <div className="mt-2 text-xs font-mono text-gray-400">
                    Time: {currentResult.checkInTime}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual Code Input Bar (Always accessible) */}
          <div className="panel p-4">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="Enter Ticket Code (e.g. EVT-7K9M-4X2B)"
                  className="input-dark font-mono text-sm uppercase tracking-wider"
                  disabled={manualSubmitting}
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim() || manualSubmitting}
                className="btn-primary px-5 py-2.5 text-sm font-semibold shrink-0"
              >
                {manualSubmitting ? 'Checking...' : 'Check In'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (5 cols): Recent Scans Feed with Undo */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="panel p-4 flex-1 flex flex-col min-h-[480px]">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">Recent Scans Feed</h3>
                <span className="px-2 py-0.5 rounded-full bg-surface-subtle text-[11px] text-gray-400 font-mono">
                  {recentScans.length}
                </span>
              </div>
              <span className="text-[11px] text-gray-400">Instant Door Feed</span>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[580px] pr-1">
              {recentScans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                  <TicketIcon size={32} className="mb-2 opacity-50" />
                  <p className="text-xs">No check-ins yet for this session.</p>
                  <p className="text-[11px] mt-1 text-gray-600">Scan QR codes or type ticket codes to begin.</p>
                </div>
              ) : (
                recentScans.map((scan, idx) => (
                  <div
                    key={`${scan.ticketCode}-${idx}`}
                    className="panel-subtle p-3 flex items-center justify-between gap-3 hover:border-surface-border-bright transition-colors animate-scale-in"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Status Icon */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          scan.status === 'VALID'
                            ? 'bg-signal-green/15 text-signal-green border border-signal-green/30'
                            : scan.status === 'DUPLICATE'
                            ? 'bg-signal-amber/15 text-signal-amber border border-signal-amber/30'
                            : scan.status === 'QUEUED'
                            ? 'bg-brand-blue/15 text-brand-cyan border border-brand-blue/30'
                            : 'bg-signal-red/15 text-signal-red border border-signal-red/30'
                        }`}
                      >
                        {scan.status === 'VALID' && <CheckIcon size={16} />}
                        {scan.status === 'DUPLICATE' && <RepeatIcon size={16} />}
                        {scan.status === 'QUEUED' && <CloudOfflineIcon size={16} />}
                        {scan.status === 'INVALID' && <XMarkIcon size={16} />}
                      </div>

                      {/* Attendee / Scan Info */}
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-white truncate">
                          {scan.attendeeName || scan.ticketCode || 'Unknown Ticket'}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                          {scan.ticketType && <span>{scan.ticketType}</span>}
                          {scan.ticketCode && <span className="font-mono text-gray-300">{scan.ticketCode}</span>}
                          <span>&bull;</span>
                          <span>{scan.checkInTime || scan.originalCheckInTime || 'Just now'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action: Undo Check-in (for successful scans) */}
                    {scan.status === 'VALID' && scan.attendeeId && (
                      <button
                        onClick={() => handleUndo(scan)}
                        className="px-2 py-1 rounded bg-surface border border-surface-border hover:bg-surface-card hover:border-signal-red/50 hover:text-signal-red text-[11px] text-gray-300 transition-colors flex items-center gap-1 shrink-0"
                        title="Undo accidental check-in"
                      >
                        <UndoIcon size={12} />
                        <span>Undo</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* End Event Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
          <div className="panel max-w-md w-full p-6 border-signal-red/40 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">End Event & Close Live Mode?</h3>
            <p className="text-xs text-gray-300 mb-6">
              Ending this event will close the Live Mode scanner, transition the event status to <strong className="text-white">ENDED</strong>, and open the official post-event analytics summary.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                disabled={endingEvent}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndEvent}
                disabled={endingEvent}
                className="btn-danger text-xs font-semibold"
              >
                {endingEvent ? 'Ending Event...' : 'Yes, End Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Live Scan Modal */}
      {showStopScanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in" onClick={() => setShowStopScanModal(false)}>
          <div className="panel max-w-md w-full p-6 border-amber-500/30 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <StopCircle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Stop Live Scanner</h3>
                <p className="text-xs text-slate-400">Pause camera or return to dashboard</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Stopping the live scanner will deactivate the camera and QR decoding. The event will remain <strong className="text-emerald-400">LIVE</strong> so you can resume scanning or let other gate personnel continue anytime.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowStopScanModal(false)}
                className="btn-secondary text-xs py-2 px-3 order-3 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsScanning(false);
                  setShowStopScanModal(false);
                }}
                className="btn-glass text-xs py-2 px-3 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 flex items-center justify-center gap-1.5 order-2"
              >
                <Pause size={13} className="fill-current" />
                Pause Scanner Here
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsScanning(false);
                  setShowStopScanModal(false);
                  onExit();
                }}
                className="btn-amber text-xs py-2 px-3 font-semibold flex items-center justify-center gap-1.5 order-1 sm:order-3"
              >
                <StopCircle size={14} />
                Stop & Exit to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
