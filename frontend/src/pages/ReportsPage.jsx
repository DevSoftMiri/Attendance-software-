import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const reports = [
    {
        key: 'attendance-summary',
        title: 'Attendance summary report',
        description: 'Download employee-wise attendance summary with branch, shift, timings, and payroll flags.',
        endpoint: '/reports/attendance-summary',
        fileName: 'attendance-summary-report.csv'
    },
    {
        key: 'attendance',
        title: 'Raw attendance report',
        description: 'Download recent attendance summary rows captured by the attendance system.',
        endpoint: '/reports/attendance',
        fileName: 'attendance-report.csv'
    },
    {
        key: 'late-arrivals',
        title: 'Late arrival report',
        description: 'Download attendance rows where late minutes exceed the general-settings late-arrival threshold.',
        endpoint: '/reports/late-arrivals',
        fileName: 'late-arrival-report.csv'
    },
    {
        key: 'leave',
        title: 'Leave report',
        description: 'Download leave request history for approval and audit review.',
        endpoint: '/reports/leave',
        fileName: 'leave-report.csv'
    },
    {
        key: 'payroll',
        title: 'Payroll run report',
        description: 'Download payroll run data for admin payroll tracking.',
        endpoint: '/reports/payroll',
        fileName: 'payroll-report.csv',
        adminOnly: true
    }
];

function triggerBrowserDownload(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
    const { user } = useAuth();
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.roleCode);

    async function downloadReport(report) {
        try {
            const response = await api.get(report.endpoint, {
                params: { format: 'csv' },
                responseType: 'blob'
            });
            triggerBrowserDownload(response.data, report.fileName);
            toast.success(`${report.title} downloaded`);
        } catch (error) {
            toast.error(error?.response?.data?.message || `Failed to download ${report.title.toLowerCase()}`);
        }
    }

    return (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
            <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Exports</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">Reports and downloads</h2>
            <div className="mt-2 text-sm text-ink-200">
                Reports below are live exports. Each download returns the current CSV file directly from the backend.
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {reports.filter((report) => !report.adminOnly || isAdmin).map((report) => (
                    <div key={report.key} className="rounded-3xl border border-white/10 bg-black/15 p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-lg font-medium text-white">{report.title}</div>
                                <div className="mt-2 text-sm text-ink-200">{report.description}</div>
                            </div>
                            {report.adminOnly ? (
                                <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-ink-300">
                                    Admin
                                </div>
                            ) : null}
                        </div>
                        <div className="mt-5 flex gap-3">
                            <button onClick={() => downloadReport(report)} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-900">
                                Download CSV
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
