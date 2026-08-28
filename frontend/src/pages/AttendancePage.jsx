import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import api from '../services/api';
import { captureCurrentLocation, collectDeviceInfo } from '../utils/attendance';
import { formatDateTime } from '../utils/date';
import { useAuth } from '../contexts/AuthContext';

export default function AttendancePage() {
    const webcamRef = useRef(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [attendanceState, setAttendanceState] = useState(null);
    const [todaySummary, setTodaySummary] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        async function loadHistory() {
            try {
                const { data } = await api.get('/attendance/history', {
                    params: user?.employeeId ? { employeeId: user.employeeId } : {}
                });
                setHistory(data.events || []);
                setTodaySummary(data.todaySummary || null);
                setAttendanceState(data.attendanceState || null);
            } catch {
                setHistory([]);
                setTodaySummary(null);
                setAttendanceState(null);
            }
        }

        loadHistory();
    }, [user?.employeeId]);

    async function submitAttendance(eventType) {
        if (!user?.employeeId) {
            toast.error('This account is not linked to an employee profile');
            return;
        }

        setLoading(true);
        try {
            const screenshot = webcamRef.current?.getScreenshot();
            const location = await captureCurrentLocation();
            const requestMeta = {
                deviceTimestamp: new Date().toISOString(),
                deviceInformation: collectDeviceInfo(),
                browserInformation: {
                    language: navigator.language,
                    platform: navigator.platform,
                    userAgent: navigator.userAgent
                }
            };

            const { data } = await api.post(`/attendance/${eventType}`, {
                employeeId: user.employeeId,
                liveImage: screenshot,
                geoLocation: location,
                requestMeta
            });

            setResult(data);
            toast.success(data.message || 'Attendance saved');
            const { data: refreshedHistory } = await api.get('/attendance/history', {
                params: user?.employeeId ? { employeeId: user.employeeId } : {}
            });
            setHistory(refreshedHistory.events || []);
            setTodaySummary(refreshedHistory.todaySummary || data.summary || null);
            setAttendanceState(refreshedHistory.attendanceState || data.attendanceState || null);
        } catch (error) {
            setResult(error?.response?.data || { message: 'Attendance submission failed' });
            toast.error(error?.response?.data?.message || 'Attendance submission failed');
        } finally {
            setLoading(false);
        }
    }

    const canCheckIn = !loading && (!attendanceState || (!attendanceState.hasCheckedIn && attendanceState.actionMode !== 'COMPLETE'));
    const canCheckOut = !loading && Boolean(attendanceState?.hasCheckedIn) && !attendanceState?.hasCheckedOut;

    return (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Face capture</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Check in or check out</h2>
                <p className="mt-2 text-sm text-ink-200">The browser captures a live image and sends it to the backend, which talks to the face service.</p>

                <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-black/25">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: 'user' }}
                        className="h-[360px] w-full object-cover"
                    />
                </div>


                <div className="mt-5 flex flex-wrap gap-3">
                    <div className="rounded-full border border-white/10 bg-black/15 px-4 py-3 text-xs uppercase tracking-[0.28em] text-ink-200">
                        Employee ID: {user?.employeeId || 'Not linked'}
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/15 px-4 py-3 text-xs uppercase tracking-[0.28em] text-ink-200">
                        {attendanceState?.actionDetail || 'Present available'}
                    </div>
                    <button
                        disabled={!canCheckIn}
                        onClick={() => submitAttendance('check-in')}
                        className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900 disabled:opacity-60"
                    >
                        {loading ? 'Processing...' : 'Check in'}
                    </button>
                    <button
                        disabled={!canCheckOut}
                        onClick={() => submitAttendance('check-out')}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                    >
                        Check out
                    </button>
                </div>
                {attendanceState?.effectiveWindow ? (
                    <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-4 text-sm text-ink-200">
                        <div className="text-xs uppercase tracking-[0.3em] text-ink-300">{attendanceState.effectiveWindow.windowLabel}</div>
                        <div className="mt-2 text-white">
                            Expected window: {formatDateTime(attendanceState.effectiveWindow.expectedCheckInTime)} to {formatDateTime(attendanceState.effectiveWindow.expectedCheckOutTime)}
                        </div>
                        <div className="mt-2 text-ink-200">Today check in: {formatDateTime(todaySummary?.firstCheckIn)}</div>
                        <div className="mt-1 text-ink-200">Today check out: {formatDateTime(todaySummary?.lastCheckOut)}</div>
                    </div>
                ) : null}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Validation summary</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Server response</h2>
                <div className="mt-6 space-y-4">
                    {result ? (
                        <>
                            <div className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-100">
                                <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Message</div>
                                <div className="mt-2 text-lg text-white">{result.message || 'Attendance processed'}</div>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-100">
                                <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Face verification</div>
                                <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-ink-100">
                                    {JSON.stringify(result.result?.validation || result.validation || result, null, 2)}
                                </pre>
                            </div>
                        </>
                    ) : (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-black/15 p-8 text-sm text-ink-200">
                            No attendance event has been submitted yet.
                        </div>
                    )}
                </div>

                <div className="mt-8 rounded-3xl border border-white/10 bg-black/15 p-5">
                    <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Recent activity</div>
                    <div className="mt-4 space-y-3 text-sm text-ink-200">
                        {history.length ? history.slice(0, 5).map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                                <div className="flex items-center justify-between gap-3">
                                    <div>{entry.eventType}</div>
                                    <div className="text-xs uppercase tracking-[0.3em] text-ink-300">{entry.validationStatus || 'PENDING'}</div>
                                </div>
                                <div className="mt-2 text-xs text-ink-300">{formatDateTime(entry.serverTimestamp || entry.createdAt)}</div>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4">No history loaded yet.</div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
