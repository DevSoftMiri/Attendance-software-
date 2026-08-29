import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { captureCurrentLocation, collectDeviceInfo } from '../utils/attendance';
import { formatDate, formatDateTime } from '../utils/date';

const INSTALL_OVERLAY_KEY = 'attendance-pwa-install-overlay-dismissed';
const FIRST_SCAN_DELAY_MS = 350;
const SCAN_INTERVAL_MS = 2000;

function detectInstallContext() {
    const userAgent = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    return {
        isIos,
        isAndroid,
        isStandalone,
        isChromiumMobile: isAndroid && /Chrome|CriOS|EdgA|SamsungBrowser/i.test(userAgent)
    };
}

export default function PublicAttendancePage() {
    const webcamRef = useRef(null);
    const scanInFlightRef = useRef(false);
    const deferredInstallPromptRef = useRef(null);
    const locationRequestStartedRef = useRef(false);
    const navigate = useNavigate();
    const installContext = detectInstallContext();
    const [location, setLocation] = useState(null);
    const [locationStatus, setLocationStatus] = useState('idle');
    const [detectedEmployee, setDetectedEmployee] = useState(null);
    const [policy, setPolicy] = useState(null);
    const [todaySummary, setTodaySummary] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [installReady, setInstallReady] = useState(false);
    const [showInstallOverlay, setShowInstallOverlay] = useState(false);
    const [attendanceState, setAttendanceState] = useState({
        hasCheckedIn: false,
        hasCheckedOut: false,
        actionMode: 'CHECK_IN'
    });
    const [lastResult, setLastResult] = useState(null);
    const [scanning, setScanning] = useState(true);
    const [cameraReady, setCameraReady] = useState(false);
    const [loadingAction, setLoadingAction] = useState('');
    const [scanStatus, setScanStatus] = useState('Preparing camera...');

    function formatWindowHint(state) {
        if (!state?.effectiveWindow) {
            return 'Standard full-day attendance window';
        }

        return `${state.effectiveWindow.windowLabel}: ${formatDateTime(state.effectiveWindow.expectedCheckInTime)} to ${formatDateTime(state.effectiveWindow.expectedCheckOutTime)}`;
    }

    function resetDetection() {
        setDetectedEmployee(null);
        setPolicy(null);
        setTodaySummary(null);
        setAttendanceState({
            hasCheckedIn: false,
            hasCheckedOut: false,
            actionMode: 'CHECK_IN'
        });
        setLastResult(null);
        setScanStatus(cameraReady ? 'Scanning for an enrolled face...' : 'Preparing camera...');
        setScanning(true);
    }

    async function requestLocationAccess(showSuccessToast = false) {
        setLocationStatus('requesting');
        const currentLocation = await captureCurrentLocation();

        if (currentLocation) {
            setLocation(currentLocation);
            setLocationStatus('granted');
            if (showSuccessToast) {
                toast.success('Location permission granted');
            }
            return currentLocation;
        }

        setLocationStatus('unavailable');
        if (showSuccessToast) {
            toast.error('Location unavailable. Please allow location access in the browser.');
        }
        return null;
    }

    useEffect(() => {
        function handleOnline() {
            setIsOnline(true);
        }

        function handleOffline() {
            setIsOnline(false);
        }

        function handleBeforeInstallPrompt(event) {
            event.preventDefault();
            deferredInstallPromptRef.current = event;
            setInstallReady(true);
        }

        function handleAppInstalled() {
            setInstallReady(false);
            setShowInstallOverlay(false);
            localStorage.setItem(INSTALL_OVERLAY_KEY, 'true');
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        const installOverlayDismissed = localStorage.getItem(INSTALL_OVERLAY_KEY) === 'true';
        if (!installContext.isStandalone && !installOverlayDismissed) {
            setShowInstallOverlay(true);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [installContext.isStandalone]);

    useEffect(() => {
        if (locationRequestStartedRef.current) {
            return;
        }

        locationRequestStartedRef.current = true;
        requestLocationAccess();
    }, []);

    useEffect(() => {
        let active = true;
        let intervalId;
        let firstScanTimeoutId;

        async function scanFace() {
            if (!active || !webcamRef.current || !cameraReady || !scanning || detectedEmployee?.id || scanInFlightRef.current) {
                return;
            }

            const screenshot = webcamRef.current.getScreenshot();
            if (!screenshot) {
                setScanStatus('Starting camera...');
                return;
            }

            try {
                scanInFlightRef.current = true;
                setScanStatus('Scanning face...');
                const { data } = await api.post('/public-attendance/identify', {
                    liveImage: screenshot,
                    requestMeta: {
                        deviceTimestamp: new Date().toISOString(),
                        deviceInformation: collectDeviceInfo(),
                        browserInformation: {
                            language: navigator.language,
                            platform: navigator.platform,
                            userAgent: navigator.userAgent
                        }
                    }
                });

                if (!active) {
                    return;
                }

                setDetectedEmployee(data.employee);
                setPolicy(data.policy || null);
                setTodaySummary(data.summary || null);
                setAttendanceState(data.attendanceState || {
                    hasCheckedIn: false,
                    hasCheckedOut: false,
                    actionMode: 'CHECK_IN'
                });
                setScanStatus(`Face detected: ${data.employee.fullName}`);
                setScanning(false);
                requestLocationAccess().then((currentLocation) => {
                    if (active) {
                        setLocation(currentLocation);
                    }
                });
            } catch (error) {
                if (!active) {
                    return;
                }

                setDetectedEmployee(null);
                setPolicy(null);
                setTodaySummary(null);
                setAttendanceState({
                    hasCheckedIn: false,
                    hasCheckedOut: false,
                    actionMode: 'CHECK_IN'
                });
                setScanStatus(error?.response?.data?.message || 'Scanning for an enrolled face...');
            } finally {
                scanInFlightRef.current = false;
            }
        }

        if (cameraReady && scanning && !detectedEmployee?.id) {
            firstScanTimeoutId = setTimeout(() => {
                scanFace();
            }, FIRST_SCAN_DELAY_MS);
        }

        intervalId = setInterval(scanFace, SCAN_INTERVAL_MS);

        return () => {
            active = false;
            if (firstScanTimeoutId) {
                clearTimeout(firstScanTimeoutId);
            }
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [cameraReady, detectedEmployee?.id, scanning]);

    useEffect(() => {
        if (!cameraReady && !detectedEmployee?.id) {
            setScanStatus('Preparing camera...');
            return;
        }

        if (cameraReady && scanning && !detectedEmployee?.id) {
            setScanStatus('Scanning for an enrolled face...');
        }
    }, [cameraReady, detectedEmployee?.id, scanning]);

    async function installApp() {
        if (!deferredInstallPromptRef.current) {
            if (installContext.isIos) {
                toast('On iPhone, tap Share and choose Add to Home Screen.');
            } else {
                toast('Use your browser menu to install this app on this device.');
            }
            return;
        }

        deferredInstallPromptRef.current.prompt();
        const choice = await deferredInstallPromptRef.current.userChoice;
        deferredInstallPromptRef.current = null;
        setInstallReady(false);
        if (choice?.outcome === 'accepted') {
            setShowInstallOverlay(false);
            localStorage.setItem(INSTALL_OVERLAY_KEY, 'true');
        }
    }

    function dismissInstallOverlay() {
        setShowInstallOverlay(false);
        localStorage.setItem(INSTALL_OVERLAY_KEY, 'true');
    }

    async function submitAttendance(actionType) {
        if (!webcamRef.current) {
            toast.error('Camera not ready');
            return;
        }
        if (!cameraReady) {
            toast.error('Camera is still warming up');
            return;
        }
        if (!isOnline) {
            toast.error('Internet connection is required to verify the face and mark attendance');
            return;
        }
        if (!detectedEmployee?.id) {
            toast.error('Wait for a face match before marking attendance');
            return;
        }

        setLoadingAction(actionType);
        try {
            const screenshot = webcamRef.current.getScreenshot();
            if (!screenshot) {
                throw new Error('Unable to capture image');
            }

            const currentLocation = await requestLocationAccess();

            const { data } = await api.post(
                actionType === 'CHECK_IN' ? '/public-attendance/check-in' : '/public-attendance/check-out',
                {
                    liveImage: screenshot,
                    geoLocation: currentLocation,
                    requestMeta: {
                        deviceTimestamp: new Date().toISOString(),
                        deviceInformation: collectDeviceInfo(),
                        browserInformation: {
                            language: navigator.language,
                            platform: navigator.platform,
                            userAgent: navigator.userAgent
                        }
                    }
                }
            );

            setLastResult(data);
            setDetectedEmployee(data.employee);
            setTodaySummary(data.summary || null);
            setAttendanceState(data.attendanceState || {
                hasCheckedIn: actionType === 'CHECK_IN',
                hasCheckedOut: actionType === 'CHECK_OUT',
                actionMode: actionType === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN'
            });
            setScanStatus(`${data.employee?.fullName || 'Employee'} ${actionType === 'CHECK_IN' ? 'marked present' : 'marked logout'}`);
            toast.success(data.message || 'Attendance marked');
        } catch (error) {
            setLastResult(error?.response?.data || null);
            toast.error(error?.response?.data?.message || 'Unable to mark attendance');
        } finally {
            setLoadingAction('');
        }
    }

    const canCheckIn = Boolean(detectedEmployee?.id) && !attendanceState.hasCheckedIn && !loadingAction;
    const canCheckOut = Boolean(detectedEmployee?.id) && attendanceState.hasCheckedIn && !attendanceState.hasCheckedOut && !loadingAction;
    const installHeadline = installContext.isIos ? 'Add this kiosk to your Home Screen' : 'Install this kiosk for one-tap attendance';
    const installBody = installContext.isIos
        ? 'Open the Share menu in Safari, tap Add to Home Screen, and launch the kiosk like a real app.'
        : installContext.isChromiumMobile
            ? 'Install the attendance kiosk for a full-screen, app-like check-in flow on this device.'
            : 'Use your browser install option to pin this kiosk for faster daily attendance.';
    const isInstalledApp = installContext.isStandalone;

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,205,102,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(77,197,255,0.18),_transparent_30%),linear-gradient(180deg,_#0b1020_0%,_#111627_56%,_#090e1b_100%)] px-3 py-3 text-white sm:px-4 sm:py-6 lg:py-8">
            {showInstallOverlay ? (
                <div className="fixed inset-0 z-50 flex items-end bg-[#050811]/80 p-3 backdrop-blur-md sm:items-center sm:justify-center sm:p-6">
                    <div className="w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,_rgba(255,209,102,0.18),_rgba(15,23,42,0.96)_28%,_rgba(11,16,32,0.98)_100%)] shadow-2xl">
                        <div className="p-5 sm:p-7">
                            <div className="text-xs uppercase tracking-[0.4em] text-[#ffd166]">Install kiosk</div>
                            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{installHeadline}</h2>
                            <p className="mt-3 text-sm leading-6 text-ink-200">{installBody}</p>

                            <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-ink-100">
                                <div>{installContext.isIos ? '1. Tap the Share icon in Safari.' : '1. Keep this page open in Chrome or another installable browser.'}</div>
                                <div>{installContext.isIos ? '2. Choose Add to Home Screen.' : '2. Tap Install App to trigger the browser install prompt.'}</div>
                                <div>{installContext.isIos ? '3. Launch the new app icon from the Home Screen for kiosk mode.' : '3. Open the installed app and use it full-screen for daily check-ins.'}</div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={installApp}
                                    className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900"
                                >
                                    {installContext.isIos ? 'Show iPhone Steps' : installReady ? 'Install App' : 'Install Guide'}
                                </button>
                                <button
                                    type="button"
                                    onClick={dismissInstallOverlay}
                                    className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white"
                                >
                                    Continue in Browser
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
            <div className={`mx-auto grid min-h-[100dvh] max-w-7xl gap-4 lg:min-h-[calc(100vh-4rem)] lg:gap-6 ${isInstalledApp ? 'lg:grid-cols-1' : 'lg:grid-cols-[1.05fr_0.95fr]'}`}>
                <section className="flex min-h-[100dvh] flex-col rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-xl sm:p-5 lg:min-h-0 lg:rounded-[32px] lg:p-8">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Public attendance kiosk</div>
                    <h1 className="mt-3 max-w-xl text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">Mark present or logout without login</h1>
                    {!isInstalledApp ? (
                        <>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-200">
                                This page scans the face automatically, checks office location, and allows the matched employee to confirm attendance directly from the kiosk.
                            </p>

                            <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-black/15 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                <div>
                                    <div className="text-sm font-medium text-white">{isOnline ? 'PWA ready for kiosk install' : 'Offline mode detected'}</div>
                                    <p className="mt-1 text-sm leading-6 text-ink-200">
                                        {isOnline
                                            ? 'Install this on your kiosk phone, tablet, or desktop for a full-screen attendance experience.'
                                            : 'The app shell stays available offline, but attendance still needs internet because face verification and policy checks run on the server.'}
                                    </p>
                                    <p className="mt-2 text-xs uppercase tracking-[0.28em] text-[#ffd166]">
                                        {installContext.isIos ? 'iPhone: Share > Add to Home Screen' : installReady ? 'Install prompt available on this device' : 'Use browser install menu if prompt is unavailable'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={installApp}
                                    className="rounded-full border border-[#ffd166]/40 bg-[#ffd166]/10 px-5 py-3 text-sm font-medium text-[#ffe4a3]"
                                >
                                    {installContext.isIos ? 'iPhone Install Steps' : installReady ? 'Install App' : 'How to Install'}
                                </button>
                            </div>
                        </>
                    ) : null}

                    <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/25 sm:mt-6 sm:rounded-[28px]">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            screenshotQuality={0.72}
                            onUserMedia={() => {
                                setCameraReady(true);
                                if (!detectedEmployee?.id) {
                                    setScanStatus('Scanning for an enrolled face...');
                                }
                            }}
                            onUserMediaError={() => {
                                setCameraReady(false);
                                setScanStatus('Camera access failed. Please allow camera permission.');
                            }}
                            videoConstraints={{
                                facingMode: 'user',
                                width: { ideal: 640 },
                                height: { ideal: 480 }
                            }}
                            className="h-[40dvh] min-h-[320px] w-full object-cover sm:h-[46dvh] lg:h-[420px]"
                        />
                    </div>

                    <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => submitAttendance('CHECK_IN')}
                            disabled={!canCheckIn}
                            className="w-full rounded-full bg-white px-5 py-3.5 text-sm font-medium text-ink-900 disabled:opacity-60"
                        >
                            {loadingAction === 'CHECK_IN' ? 'Marking present...' : 'Mark Present'}
                        </button>
                        <button
                            type="button"
                            onClick={() => submitAttendance('CHECK_OUT')}
                            disabled={!canCheckOut}
                            className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-medium text-white disabled:opacity-60"
                        >
                            {loadingAction === 'CHECK_OUT' ? 'Marking logout...' : 'Mark Logout'}
                        </button>
                        <button
                            type="button"
                            onClick={() => requestLocationAccess(true)}
                            className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-medium text-white"
                        >
                            {locationStatus === 'requesting' ? 'Requesting location...' : 'Allow Location'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (detectedEmployee?.id) {
                                    resetDetection();
                                    return;
                                }
                                setScanning((current) => !current);
                            }}
                            className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-medium text-white"
                        >
                            {detectedEmployee?.id ? 'Scan New Face' : scanning ? 'Stop Scan' : 'Start Scan'}
                        </button>
                    </div>

                    <div className="mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white"
                        >
                            Login
                        </button>
                    </div>

                    <div className="mt-4 flex-1 rounded-[28px] border border-white/10 bg-black/15 p-4 text-sm text-ink-200 sm:mt-5 sm:p-5">
                        <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Live scan status</div>
                        <div className="mt-2 text-base font-medium text-white sm:text-lg">{scanStatus}</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Scanner</div>
                                <div className="mt-1 text-white">{detectedEmployee?.id ? 'Locked on detected employee' : scanning ? 'Active' : 'Paused'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Attendance action</div>
                                <div className="mt-1 text-white">{attendanceState.actionDetail || (attendanceState.actionMode === 'CHECK_OUT' ? 'Logout available' : 'Present available')}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Connection</div>
                                <div className="mt-1 text-white">{isOnline ? 'Online' : 'Offline'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-2">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Location</div>
                                <div className="mt-1 break-words text-white">
                                    {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Not available'}
                                </div>
                                <div className="mt-1 text-xs text-ink-300">
                                    {locationStatus === 'granted'
                                        ? 'Permission granted'
                                        : locationStatus === 'requesting'
                                            ? 'Waiting for browser location permission'
                                            : 'Tap Allow Location if the browser did not prompt yet'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-2">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Accuracy</div>
                                <div className="mt-1 text-white">{location?.accuracy ? `${Math.round(location.accuracy)} m` : 'Not available'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Office network</div>
                                <div className="mt-1 text-white">{policy?.officeIpRequired ? (policy.officeIpVerified ? 'Verified' : 'Not verified') : 'Not enforced'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-2">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Attendance window</div>
                                <div className="mt-1 text-white">{formatWindowHint(attendanceState)}</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={`space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-xl sm:space-y-6 sm:p-5 lg:rounded-[32px] lg:p-8 ${isInstalledApp ? 'hidden' : ''}`}>
                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Detected employee</div>
                        <div className="mt-3 rounded-3xl border border-white/10 bg-black/15 p-5">
                            <div className="text-2xl font-semibold text-white">{detectedEmployee?.fullName || 'Waiting for face detection'}</div>
                            <div className="mt-2 text-sm text-ink-200">{detectedEmployee?.employeeCode || 'No enrolled face detected yet'}</div>
                            <div className="mt-4 grid gap-2 text-sm text-ink-200">
                                <div>Branch: {detectedEmployee?.branchName || detectedEmployee?.branchId || '-'}</div>
                                <div>Department: {detectedEmployee?.departmentId || '-'}</div>
                                <div>Shift: {detectedEmployee?.shiftId || '-'}</div>
                                <div>Current IP: {policy?.currentIp || '-'}</div>
                                <div>Geofence: {policy?.branch ? `${policy.branch.name} (${policy.branch.radiusMetres} m radius)` : 'Not configured'}</div>
                                <div>Leave window: {attendanceState.leaveMode ? attendanceState.leaveMode.replaceAll('_', ' ') : 'None'}</div>
                                <div>Today check in: {formatDateTime(todaySummary?.firstCheckIn)}</div>
                                <div>Today check out: {formatDateTime(todaySummary?.lastCheckOut)}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Latest response</div>
                        <div className="mt-3 rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-100">
                            {lastResult ? (
                                <>
                                    <div className="text-lg font-medium text-white">{lastResult.message || 'Attendance updated'}</div>
                                    <div className="mt-3 space-y-2 text-ink-200">
                                        <div>Employee: {lastResult.employee?.fullName || detectedEmployee?.fullName || '-'}</div>
                                        <div>Date: {formatDate(lastResult.summary?.attendanceDate)}</div>
                                        <div>Check in: {formatDateTime(lastResult.summary?.firstCheckIn)}</div>
                                        <div>Check out: {formatDateTime(lastResult.summary?.lastCheckOut)}</div>
                                        <div>Status: {lastResult.summary?.attendanceStatus || lastResult.result?.validation?.validationStatus || '-'}</div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-ink-200">No attendance action yet.</div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
