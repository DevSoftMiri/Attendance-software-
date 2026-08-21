import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 text-white">
            <div className="max-w-lg rounded-[28px] border border-white/10 bg-white/5 p-8 text-center shadow-soft">
                <div className="text-sm uppercase tracking-[0.35em] text-ink-300">404</div>
                <h1 className="mt-4 text-4xl font-semibold">Page not found</h1>
                <p className="mt-3 text-ink-200">The requested route does not exist in this scaffold.</p>
                <Link to="/" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-medium text-ink-900">
                    Go home
                </Link>
            </div>
        </div>
    );
}
