import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import api from '../services/api';
import { captureCurrentLocation, collectDeviceInfo } from '../utils/attendance';
import { formatDate, formatDateTime } from '../utils/date';

export default function PublicAttendancePage() {
    const webcamRef = useRef(null);
    const deferredInstallPromptRef = useRef(null);
    const [location, setLocation] = useState(null);
    const [detectedEmployee, setDetectedEmployee] = useState(null);
    const [policy, setPolicy] = useState(null);
    const [todaySummary, setTodaySummary] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [installReady, setInstallReady] = useState(false);
    const [attendanceState, setAttendanceState] = useState({
        hasCheckedIn: false,
        hasCheckedOut: false,
        actionMode: 'CHECK_IN'
    });
    const [lastResult, setLastResult] = useState(null);
    const [scanning, setScanning] = useState(true);
    const [loadingAction, setLoadingAction] = useState('');
    const [scanStatus, setScanStatus] = useState('Preparing camera...');

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
        setScanStatus('Scanning for an enrolled face...');
        setScanning(true);
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

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        let active = true;
        let intervalId;

        async function scanFace() {
            if (!active || !webcamRef.current || !scanning || detectedEmployee?.id) {
                return;
            }

            const currentLocation = await captureCurrentLocation();
            if (active) {
                setLocation(currentLocation);
            }

            const screenshot = webcamRef.current.getScreenshot();
            if (!screenshot) {
                setScanStatus('Camera is warming up...');
                return;
            }

            try {
                setScanStatus('Scanning face...');
                const { data } = await api.post('/public-attendance/identify', {
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
            }
        }

        scanFace();
        intervalId = setInterval(scanFace, 4000);

        return () => {
            active = false;
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [detectedEmployee?.id, scanning]);

    async function installApp() {
        if (!deferredInstallPromptRef.current) {
            toast('Use your browser menu to install this app on this device.');
            return;
        }

        deferredInstallPromptRef.current.prompt();
        await deferredInstallPromptRef.current.userChoice;
        deferredInstallPromptRef.current = null;
        setInstallReady(false);
    }

    async function submitAttendance(actionType) {
        if (!webcamRef.current) {
            toast.error('Camera not ready');
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

            const currentLocation = await captureCurrentLocation();
            setLocation(currentLocation);

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

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,205,102,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(77,197,255,0.18),_transparent_30%),linear-gradient(180deg,_#0b1020_0%,_#111627_56%,_#090e1b_100%)] px-3 py-3 text-white sm:px-4 sm:py-6 lg:py-8">
            <div className="mx-auto grid min-h-[100dvh] max-w-7xl gap-4 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
                <section className="flex min-h-[100dvh] flex-col rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-xl sm:p-5 lg:min-h-0 lg:rounded-[32px] lg:p-8">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Public attendance kiosk</div>
                    <h1 className="mt-3 max-w-xl text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">Mark present or logout without login</h1>
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
                        </div>
                        <button
                            type="button"
                            onClick={installApp}
                            className="rounded-full border border-[#ffd166]/40 bg-[#ffd166]/10 px-5 py-3 text-sm font-medium text-[#ffe4a3]"
                        >
                            {installReady ? 'Install App' : 'How to Install'}
                        </button>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/25 sm:mt-6 sm:rounded-[28px]">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: 'user' }}
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
                                <div className="mt-1 text-white">{attendanceState.actionMode === 'CHECK_OUT' ? 'Logout available' : 'Present available'}</div>
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
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-2">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Accuracy</div>
                                <div className="mt-1 text-white">{location?.accuracy ? `${Math.round(location.accuracy)} m` : 'Not available'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <div className="text-[11px] uppercase tracking-[0.25em] text-ink-300">Office network</div>
                                <div className="mt-1 text-white">{policy?.officeIpRequired ? (policy.officeIpVerified ? 'Verified' : 'Not verified') : 'Not enforced'}</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-soft backdrop-blur-xl sm:space-y-6 sm:p-5 lg:rounded-[32px] lg:p-8">
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
