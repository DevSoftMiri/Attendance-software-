import { useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import { formatDateTime } from '../utils/date';

export default function FaceRegistrationPage() {
    const webcamRef = useRef(null);
    const { register, handleSubmit, watch, reset, setValue } = useForm({
        defaultValues: {
            employeeId: '',
            employeeName: ''
        }
    });
    const [captures, setCaptures] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [deletingProfile, setDeletingProfile] = useState(false);
    const employeeId = watch('employeeId');

    const captureLabel = useMemo(() => {
        if (captures.length >= 3) {
            return 'All required captures taken';
        }
        return `Capture ${captures.length + 1} of 3`;
    }, [captures.length]);
    const displayImages = captures.length ? captures : (profile?.previews || []);

    useEffect(() => {
        async function loadEmployees() {
            try {
                const { data } = await api.get('/employees');
                setEmployees(data.employees || []);
            } catch {
                setEmployees([]);
            }
        }

        loadEmployees();
    }, []);

    useEffect(() => {
        let active = true;

        async function loadProfile() {
            if (!employeeId) {
                setProfile(null);
                return;
            }

            setProfileLoading(true);
            try {
                const { data } = await api.get(`/face/${employeeId}`);
                if (active) {
                    setProfile(data);
                }
            } catch {
                if (active) {
                    setProfile(null);
                }
            } finally {
                if (active) {
                    setProfileLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            active = false;
        };
    }, [employeeId]);

    function takeCapture() {
        const image = webcamRef.current?.getScreenshot();
        if (!image) {
            toast.error('Camera image not available');
            return;
        }

        setCaptures((current) => (current.length >= 3 ? current : [...current, image]));
        toast.success('Face image captured');
    }

    function clearCaptures() {
        setCaptures([]);
    }

    async function deleteProfile() {
        if (!employeeId) {
            toast.error('Select an employee first');
            return;
        }

        if (!window.confirm('Delete the saved face profile for this employee?')) {
            return;
        }

        setDeletingProfile(true);
        try {
            await api.delete(`/face/${employeeId}`);
            setProfile({
                employeeId,
                exists: false,
                registeredImages: 0,
                embeddingCached: false,
                updatedAt: null,
                previews: []
            });
            setCaptures([]);
            toast.success('Old face profile deleted');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete face profile');
        } finally {
            setDeletingProfile(false);
        }
    }

    async function onSubmit(values) {
        if (captures.length < 3) {
            toast.error('Capture three face images before enrolment');
            return;
        }

        setSubmitting(true);
        try {
            const { data } = await api.post('/face/enrol', {
                employeeId: values.employeeId,
                images: captures,
                detector: 'opencv',
                modelName: 'Facenet512'
            });
            toast.success(data.detail || 'Face profile registered');
            setCaptures([]);
            setProfile({
                employeeId: values.employeeId,
                exists: true,
                registeredImages: captures.length,
                embeddingCached: true,
                updatedAt: new Date().toISOString(),
                previews: [...captures]
            });
            reset(values);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to register face');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Face enrolment</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Register employee face</h2>
                <p className="mt-2 text-sm text-ink-200">Capture three clear reference images before linking the profile to attendance verification.</p>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                    <select
                        {...register('employeeId', {
                            onChange: (event) => {
                                const selectedEmployee = employees.find((entry) => String(entry.id) === String(event.target.value));
                                setValue('employeeName', selectedEmployee?.fullName || '');
                            }
                        })}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    >
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeCode})</option>
                        ))}
                    </select>
                    <input
                        {...register('employeeName')}
                        placeholder="Employee name"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400"
                        readOnly
                    />
                </form>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/25">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: 'user' }}
                        className="h-[360px] w-full object-cover"
                    />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={takeCapture}
                        disabled={!employeeId || captures.length >= 3}
                        className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {captureLabel}
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit(onSubmit)}
                        disabled={!employeeId || submitting}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {submitting ? 'Registering...' : 'Save face profile'}
                    </button>
                    <button
                        type="button"
                        onClick={clearCaptures}
                        disabled={!captures.length}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                        Clear captures
                    </button>
                </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Captured set</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Three reference images</h2>
                <div className="mt-6 rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                    <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Saved profile</div>
                    {!employeeId ? (
                        <div className="mt-2">Select an employee to check whether a face profile is already saved.</div>
                    ) : profileLoading ? (
                        <div className="mt-2">Checking saved profile...</div>
                    ) : profile?.exists ? (
                        <>
                            <div className="mt-2 text-white">A saved face profile already exists for this employee.</div>
                            <div className="mt-2">Registered images: {profile.registeredImages}</div>
                            <div className="mt-2">Last updated: {formatDateTime(profile.updatedAt)}</div>
                            <button
                                type="button"
                                onClick={deleteProfile}
                                disabled={deletingProfile}
                                className="mt-4 rounded-full border border-red-400/40 bg-red-500/10 px-5 py-3 text-sm font-medium text-red-100 disabled:opacity-50"
                            >
                                {deletingProfile ? 'Deleting old profile...' : 'Delete old profile'}
                            </button>
                        </>
                    ) : (
                        <div className="mt-2">No saved face profile found for this employee yet.</div>
                    )}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {['Straight', 'Left', 'Right'].map((label, index) => (
                        <div key={label} className="rounded-3xl border border-white/10 bg-black/15 p-4">
                            <div className="text-xs uppercase tracking-[0.3em] text-ink-300">{label}</div>
                            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                                {displayImages[index] ? (
                                    <img src={displayImages[index]} alt={`${label} capture`} className="h-44 w-full object-cover" />
                                ) : (
                                    <div className="flex h-44 items-center justify-center text-sm text-ink-300">Pending capture</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-black/15 p-5 text-sm text-ink-200">
                    The face service stores private reference images and returns a verification-ready profile for check-in and check-out.
                </div>
            </section>
        </div>
    );
}
