import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatDate, formatDateTime, parseDateInput } from '../utils/date';

function formatMinutes(minutes = 0) {
    const total = Number(minutes || 0);
    const hours = Math.floor(total / 60);
    const remainingMinutes = total % 60;
    return `${String(hours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m`;
}

export default function AttendanceSummaryPage() {
    const [rows, setRows] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [branches, setBranches] = useState([]);
    const [filters, setFilters] = useState({
        employeeId: '',
        departmentId: '',
        branchId: '',
        startDate: '',
        endDate: '',
        status: ''
    });
    const [loading, setLoading] = useState(false);

    const employeeOptions = useMemo(() => employees, [employees]);

    async function loadReferenceData() {
        try {
            const [{ data: employeeData }, { data: settingsData }] = await Promise.all([
                api.get('/employees'),
                api.get('/settings')
            ]);
            setEmployees(employeeData.employees || []);
            setDepartments(settingsData.organisation?.departments || []);
            setBranches(settingsData.branches || []);
        } catch {
            setEmployees([]);
            setDepartments([]);
            setBranches([]);
        }
    }

    async function loadSummary(currentFilters = filters) {
        setLoading(true);
        try {
            const params = {};
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value) {
                    params[key] = key === 'startDate' || key === 'endDate' ? parseDateInput(value) : value;
                }
            });

            const { data } = await api.get('/reports/attendance-summary', { params });
            setRows(data.summaries || []);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load attendance summary');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadReferenceData();
        loadSummary();
    }, []);

    function handleChange(event) {
        const { name, value } = event.target;
        setFilters((current) => ({ ...current, [name]: value }));
    }

    function handleSearch(event) {
        event.preventDefault();
        loadSummary(filters);
    }

    function handleReset() {
        const cleared = {
            employeeId: '',
            departmentId: '',
            branchId: '',
            startDate: '',
            endDate: '',
            status: ''
        };
        setFilters(cleared);
        loadSummary(cleared);
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Attendance summary</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Employee-wise attendance table</h2>
                <p className="mt-2 text-sm text-ink-200">View each employee's day-wise attendance with filterable summaries for branch, department, and status.</p>

                <form onSubmit={handleSearch} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <select name="employeeId" value={filters.employeeId} onChange={handleChange} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">All employees</option>
                        {employeeOptions.map((employee) => (
                            <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                        ))}
                    </select>
                    <select name="departmentId" value={filters.departmentId} onChange={handleChange} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">All departments</option>
                        {departments.map((department) => (
                            <option key={department.id} value={department.id}>{department.name}</option>
                        ))}
                    </select>
                    <select name="branchId" value={filters.branchId} onChange={handleChange} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">All branches</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                    <input name="startDate" value={filters.startDate} onChange={handleChange} type="text" placeholder="DD/MM/YYYY" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input name="endDate" value={filters.endDate} onChange={handleChange} type="text" placeholder="DD/MM/YYYY" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <select name="status" value={filters.status} onChange={handleChange} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="">All statuses</option>
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="HALF_DAY">Half Day</option>
                        <option value="ON_LEAVE">On Leave</option>
                        <option value="WFH">Work From Home</option>
                    </select>
                    <div className="flex gap-3 md:col-span-2 xl:col-span-3">
                        <button type="submit" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink-900">Apply filters</button>
                        <button type="button" onClick={handleReset} className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white">Reset</button>
                    </div>
                </form>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-soft">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Daily rows</div>
                        <div className="mt-1 text-sm text-ink-200">{loading ? 'Loading summary...' : `${rows.length} row(s) loaded`}</div>
                    </div>
                </div>

                <div className="overflow-auto">
                    <table className="min-w-full border-collapse text-left text-sm text-white">
                        <thead className="bg-black/25 text-xs uppercase tracking-[0.25em] text-ink-300">
                            <tr>
                                <th className="px-5 py-4">Employee</th>
                                <th className="px-5 py-4">Department</th>
                                <th className="px-5 py-4">Branch</th>
                                <th className="px-5 py-4">Date</th>
                                <th className="px-5 py-4">Check In</th>
                                <th className="px-5 py-4">Check Out</th>
                                <th className="px-5 py-4">Working Hours</th>
                                <th className="px-5 py-4">Late</th>
                                <th className="px-5 py-4">Overtime</th>
                                <th className="px-5 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length ? rows.map((row) => (
                                <tr key={row.id} className="border-t border-white/10 bg-white/0 hover:bg-white/5">
                                    <td className="px-5 py-4">
                                        <div className="font-medium text-white">{row.employeeName}</div>
                                        <div className="text-xs uppercase tracking-[0.25em] text-ink-300">{row.employeeCode}</div>
                                    </td>
                                    <td className="px-5 py-4">{row.departmentName}</td>
                                    <td className="px-5 py-4">{row.branchName}</td>
                                    <td className="px-5 py-4">{formatDate(row.attendanceDate)}</td>
                                    <td className="px-5 py-4">{formatDateTime(row.firstCheckIn)}</td>
                                    <td className="px-5 py-4">{formatDateTime(row.lastCheckOut)}</td>
                                    <td className="px-5 py-4">{formatMinutes(row.totalWorkingMinutes)}</td>
                                    <td className="px-5 py-4">{formatMinutes(row.lateMinutes)}</td>
                                    <td className="px-5 py-4">{formatMinutes(row.overtimeMinutes)}</td>
                                    <td className="px-5 py-4">
                                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
                                            {row.attendanceStatus}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="10" className="px-5 py-10 text-center text-sm text-ink-200">
                                        No attendance rows found for the selected filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
