export default function MetricCard({ label, value, hint }) {
    return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-ink-300">{label}</p>
            <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
            <p className="mt-2 text-sm text-ink-200">{hint}</p>
        </div>
    );
}
