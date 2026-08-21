import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Fingerprint, ShieldCheck, Clock3, MapPinned } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { register, handleSubmit } = useForm();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function onSubmit(values) {
        setLoading(true);
        setError('');
        try {
            const { user } = await login(values);
            const rolePath = user?.roleCode || 'STAFF';
            navigate(`/dashboard/${rolePath.toLowerCase().replace('_', '-')}`);
        } catch (exception) {
            setError(exception?.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,205,102,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(77,197,255,0.18),_transparent_30%),linear-gradient(180deg,_#0b1020_0%,_#111627_56%,_#090e1b_100%)] px-4 py-10 text-white">
            <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-soft backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
                <section className="flex items-start justify-center bg-black/20 p-4 sm:p-6 lg:order-2 lg:items-center lg:border-l lg:border-t-0 lg:p-12">
                    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0f1528]/90 p-6 shadow-soft sm:p-8">
                        <div className="text-sm uppercase tracking-[0.35em] text-ink-300">Sign in</div>
                        <h2 className="mt-3 text-3xl font-semibold text-white">Welcome back</h2>
                        <p className="mt-2 text-sm text-ink-200">Use your portal credentials to enter the dashboard.</p>

                        <label className="mt-8 block text-sm text-ink-200">
                            Email
                            <input
                                {...register('email')}
                                type="email"
                                placeholder="jatin@gmail.com"
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-ink-400 focus:border-white/30"
                            />
                        </label>

                        <label className="mt-5 block text-sm text-ink-200">
                            Password
                            <input
                                {...register('password')}
                                type="password"
                                placeholder="Enter your password"
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-ink-400 focus:border-white/30"
                            />
                        </label>

                        {error ? <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-6 w-full rounded-2xl bg-white px-4 py-3 font-medium text-ink-900 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'Signing in...' : 'Enter dashboard'}
                        </button>

                        <div className="mt-4 text-center text-sm text-ink-200">
                            Need to mark attendance without login?{' '}
                            <Link to="/public-attendance" className="font-medium text-white underline underline-offset-4">
                                Open the public kiosk
                            </Link>
                        </div>
                    </form>
                </section>

                <section className="relative hidden p-8 lg:order-1 lg:block lg:p-12">
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_32%,transparent_68%,rgba(255,255,255,0.05))]" />
                    <div className="relative z-10">
                        <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-ink-200">
                            Workforce OS
                        </div>
                        <h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight text-white lg:text-6xl">
                            Attendance, leave, payroll, and face verification in one controlled flow.
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg text-ink-200">
                            This shell keeps the browser lightweight while the backend validates sessions, shifts, office geolocation, and DeepFace results.
                        </p>

                        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                ['Face check', <Fingerprint size={18} />],
                                ['Geo validation', <MapPinned size={18} />],
                                ['Shift rules', <Clock3 size={18} />],
                                ['Secure access', <ShieldCheck size={18} />]
                            ].map(([label, icon]) => (
                                <div key={label} className="rounded-3xl border border-white/10 bg-black/15 p-4">
                                    <div className="flex items-center gap-3 text-sm text-ink-100">
                                        {icon}
                                        <span>{label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
