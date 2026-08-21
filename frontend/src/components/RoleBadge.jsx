export default function RoleBadge({ role }) {
    return (
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-white">
            {role.replaceAll('_', ' ')}
        </span>
    );
}
