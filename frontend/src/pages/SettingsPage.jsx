import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function SettingsPage() {
    const organisationForm = useForm();
    const shiftForm = useForm();
    const branchForm = useForm();
    const approvedIpForm = useForm({ defaultValues: { isActive: 'true' } });
    const [organisation, setOrganisation] = useState(null);
    const [shifts, setShifts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [approvedIpAddresses, setApprovedIpAddresses] = useState([]);

    async function loadSettings() {
        try {
            const { data } = await api.get('/settings');
            setOrganisation(data.organisation || null);
            setShifts(data.shifts || []);
            setBranches(data.branches || []);
            setApprovedIpAddresses(data.approvedIpAddresses || []);

            if (data.organisation) {
                organisationForm.reset({
                    ...data.organisation,
                    geofenceRadius: data.organisation.attendancePolicies?.geofenceRadius ?? 150,
                    maxLateArrivalMinutes: data.organisation.attendancePolicies?.maxLateArrivalMinutes ?? 0,
                    carryForwardUnusedPaidLeave: String(data.organisation.attendancePolicies?.carryForwardUnusedPaidLeave !== false),
                    standardWorkingHoursPerDay: data.organisation.payrollSettings?.standardWorkingHoursPerDay ?? 8,
                    graceMinutes: data.organisation.payrollSettings?.graceMinutes ?? 15,
                    halfDayMinimumMinutes: data.organisation.payrollSettings?.halfDayMinimumMinutes ?? 240,
                    overtimeEnabled: String(data.organisation.payrollSettings?.overtimeEnabled !== false),
                    overtimeMinimumMinutes: data.organisation.payrollSettings?.overtimeMinimumMinutes ?? 0,
                    overtimeRateType: data.organisation.payrollSettings?.overtimeRateType ?? 'fixed',
                    salaryCalculationMethod: data.organisation.payrollSettings?.salaryCalculationMethod ?? 'working-days',
                    holidaysPaid: String(data.organisation.payrollSettings?.holidaysPaid !== false),
                    weekOffPaid: String(data.organisation.payrollSettings?.weekOffPaid !== false),
                    shortHoursDeductionEnabled: String(data.organisation.payrollSettings?.shortHoursDeductionEnabled !== false),
                    shortHoursDeductionMethod: data.organisation.payrollSettings?.shortHoursDeductionMethod ?? 'accumulated',
                    periodStartDay: data.organisation.payrollSettings?.periodStartDay ?? 1,
                    periodEndDay: data.organisation.payrollSettings?.periodEndDay ?? 31,
                    periodEndMonthOffset: data.organisation.payrollSettings?.periodEndMonthOffset ?? 0,
                    payDayOfMonth: data.organisation.payrollSettings?.payDayOfMonth ?? 7,
                    payMonthOffset: data.organisation.payrollSettings?.payMonthOffset ?? 1
                });
            }
        } catch {
            setOrganisation(null);
        }
    }

    useEffect(() => {
        loadSettings();
    }, []);

    async function saveOrganisation(values) {
        try {
            const payload = {
                id: organisation?.id || 1,
                name: values.name,
                initial: values.initial,
                officeAddress: values.officeAddress,
                payrollPeriod: values.payrollPeriod,
                attendancePolicies: {
                    geofenceRadius: Number(values.geofenceRadius || 150),
                    maxLateArrivalMinutes: Number(values.maxLateArrivalMinutes || 0),
                    carryForwardUnusedPaidLeave: values.carryForwardUnusedPaidLeave === 'true' || values.carryForwardUnusedPaidLeave === true
                },
                payrollSettings: {
                    standardWorkingHoursPerDay: Number(values.standardWorkingHoursPerDay || 8),
                    graceMinutes: Number(values.graceMinutes || 15),
                    halfDayMinimumMinutes: Number(values.halfDayMinimumMinutes || 240),
                    overtimeEnabled: values.overtimeEnabled === 'true' || values.overtimeEnabled === true,
                    overtimeMinimumMinutes: Number(values.overtimeMinimumMinutes || 0),
                    overtimeRateType: values.overtimeRateType || 'fixed',
                    salaryCalculationMethod: values.salaryCalculationMethod || 'working-days',
                    holidaysPaid: values.holidaysPaid === 'true' || values.holidaysPaid === true,
                    weekOffPaid: values.weekOffPaid === 'true' || values.weekOffPaid === true,
                    shortHoursDeductionEnabled: values.shortHoursDeductionEnabled === 'true' || values.shortHoursDeductionEnabled === true,
                    shortHoursDeductionMethod: values.shortHoursDeductionMethod || 'accumulated',
                    periodStartDay: Number(values.periodStartDay || 1),
                    periodEndDay: Number(values.periodEndDay || 31),
                    periodEndMonthOffset: Number(values.periodEndMonthOffset || 0),
                    payDayOfMonth: Number(values.payDayOfMonth || 7),
                    payMonthOffset: Number(values.payMonthOffset || 1)
                }
            };
            const { data } = await api.put('/settings/organisation', payload);
            setOrganisation(data.organisation);
            organisationForm.reset({
                ...data.organisation,
                geofenceRadius: data.organisation.attendancePolicies?.geofenceRadius ?? 150,
                maxLateArrivalMinutes: data.organisation.attendancePolicies?.maxLateArrivalMinutes ?? 0,
                carryForwardUnusedPaidLeave: String(data.organisation.attendancePolicies?.carryForwardUnusedPaidLeave !== false),
                standardWorkingHoursPerDay: data.organisation.payrollSettings?.standardWorkingHoursPerDay ?? 8,
                graceMinutes: data.organisation.payrollSettings?.graceMinutes ?? 15,
                halfDayMinimumMinutes: data.organisation.payrollSettings?.halfDayMinimumMinutes ?? 240,
                overtimeEnabled: String(data.organisation.payrollSettings?.overtimeEnabled !== false),
                overtimeMinimumMinutes: data.organisation.payrollSettings?.overtimeMinimumMinutes ?? 0,
                overtimeRateType: data.organisation.payrollSettings?.overtimeRateType ?? 'fixed',
                salaryCalculationMethod: data.organisation.payrollSettings?.salaryCalculationMethod ?? 'working-days',
                holidaysPaid: String(data.organisation.payrollSettings?.holidaysPaid !== false),
                weekOffPaid: String(data.organisation.payrollSettings?.weekOffPaid !== false),
                shortHoursDeductionEnabled: String(data.organisation.payrollSettings?.shortHoursDeductionEnabled !== false),
                shortHoursDeductionMethod: data.organisation.payrollSettings?.shortHoursDeductionMethod ?? 'accumulated',
                periodStartDay: data.organisation.payrollSettings?.periodStartDay ?? 1,
                periodEndDay: data.organisation.payrollSettings?.periodEndDay ?? 31,
                periodEndMonthOffset: data.organisation.payrollSettings?.periodEndMonthOffset ?? 0,
                payDayOfMonth: data.organisation.payrollSettings?.payDayOfMonth ?? 7,
                payMonthOffset: data.organisation.payrollSettings?.payMonthOffset ?? 1
            });
            toast.success('Organisation settings updated');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to update settings');
        }
    }

    async function saveShift(values) {
        try {
            const payload = {
                ...values,
                organisationId: organisation?.id || 1,
                breakDurationMinutes: Number(values.breakDurationMinutes || 0),
                requiredWorkingHours: Number(values.requiredWorkingHours || 8),
                graceTimeMinutes: Number(values.graceTimeMinutes || 0),
                earlyLogoutThresholdMinutes: Number(values.earlyLogoutThresholdMinutes || 0),
                halfDayThresholdMinutes: Number(values.halfDayThresholdMinutes || 0),
                overtimeThresholdMinutes: Number(values.overtimeThresholdMinutes || 0),
                overnightShift: values.overnightShift === 'true' || values.overnightShift === true
            };

            if (values.id) {
                await api.patch(`/settings/shifts/${values.id}`, payload);
                toast.success('Shift updated');
            } else {
                await api.post('/settings/shifts', payload);
                toast.success('Shift created');
            }

            shiftForm.reset();
            await loadSettings();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save shift');
        }
    }

    async function saveBranch(values) {
        try {
            const payload = {
                ...values,
                organisationId: organisation?.id || 1,
                latitude: values.latitude === '' ? null : Number(values.latitude),
                longitude: values.longitude === '' ? null : Number(values.longitude),
                radiusMetres: Number(values.radiusMetres || 150),
                isActive: values.isActive === 'true' || values.isActive === true
            };

            if (values.id) {
                await api.patch(`/settings/branches/${values.id}`, payload);
                toast.success('Branch updated');
            } else {
                await api.post('/settings/branches', payload);
                toast.success('Branch created');
            }

            branchForm.reset();
            await loadSettings();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save branch');
        }
    }

    async function saveApprovedIpAddress(values) {
        try {
            const payload = {
                ...values,
                organisationId: organisation?.id || 1,
                branchId: values.branchId ? Number(values.branchId) : null,
                isActive: values.isActive === 'true' || values.isActive === true
            };

            if (values.id) {
                await api.patch(`/settings/approved-ip-addresses/${values.id}`, payload);
                toast.success('Office network updated');
            } else {
                await api.post('/settings/approved-ip-addresses', payload);
                toast.success('Office network added');
            }

            approvedIpForm.reset({ isActive: 'true' });
            await loadSettings();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save office network');
        }
    }

    async function removeShift(id) {
        try {
            await api.delete(`/settings/shifts/${id}`);
            toast.success('Shift deleted');
            await loadSettings();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete shift');
        }
    }

    async function removeBranch(id) {
        try {
            await api.delete(`/settings/branches/${id}`);
            toast.success('Branch deleted');
            await loadSettings();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete branch');
        }
    }

    async function removeApprovedIpAddress(id) {
        try {
            await api.delete(`/settings/approved-ip-addresses/${id}`);
            toast.success('Office network deleted');
            await loadSettings();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete office network');
        }
    }

    function editShift(shift) {
        shiftForm.reset({
            id: shift.id,
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakDurationMinutes: shift.breakDurationMinutes,
            requiredWorkingHours: shift.requiredWorkingHours,
            graceTimeMinutes: shift.graceTimeMinutes,
            earlyLogoutThresholdMinutes: shift.earlyLogoutThresholdMinutes,
            halfDayThresholdMinutes: shift.halfDayThresholdMinutes,
            overtimeThresholdMinutes: shift.overtimeThresholdMinutes,
            overnightShift: String(Boolean(shift.overnightShift)),
            isActive: String(Boolean(shift.isActive))
        });
    }

    function editBranch(branch) {
        branchForm.reset({
            id: branch.id,
            name: branch.name,
            code: branch.code,
            address: branch.address,
            latitude: branch.latitude,
            longitude: branch.longitude,
            radiusMetres: branch.radiusMetres,
            isActive: String(Boolean(branch.isActive))
        });
    }

    function editApprovedIpAddress(entry) {
        approvedIpForm.reset({
            id: entry.id,
            ipAddress: entry.ipAddress,
            description: entry.description,
            branchId: entry.branchId ? String(entry.branchId) : '',
            isActive: String(Boolean(entry.isActive))
        });
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Organisation</div>
                <h2 className="mt-3 text-3xl font-semibold text-white">Core settings</h2>
                <form onSubmit={organisationForm.handleSubmit(saveOrganisation)} className="mt-6 space-y-4">
                    <input {...organisationForm.register('name')} placeholder="Organisation name" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...organisationForm.register('initial')} placeholder="Organisation initial" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...organisationForm.register('officeAddress')} placeholder="Office address" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <input {...organisationForm.register('payrollPeriod')} placeholder="Payroll period" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <input {...organisationForm.register('geofenceRadius')} type="number" placeholder="Geofence radius (m)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                        <input {...organisationForm.register('maxLateArrivalMinutes')} type="number" min="0" placeholder="Maximum late arrival minutes" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                    </div>
                    <select {...organisationForm.register('carryForwardUnusedPaidLeave')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                        <option value="true">Carry forward unused paid leave</option>
                        <option value="false">Do not carry forward</option>
                    </select>
                    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                        <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Payroll cycle</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <input {...organisationForm.register('periodStartDay')} type="number" min="1" max="31" placeholder="Period start day" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <input {...organisationForm.register('periodEndDay')} type="number" min="1" max="31" placeholder="Period end day" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <select {...organisationForm.register('periodEndMonthOffset')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                <option value="0">End in same month</option>
                                <option value="1">End in next month</option>
                            </select>
                            <input {...organisationForm.register('payDayOfMonth')} type="number" min="1" max="31" placeholder="Pay day" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <select {...organisationForm.register('payMonthOffset')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white sm:col-span-2">
                                <option value="0">Pay in period end month</option>
                                <option value="1">Pay in month after period end</option>
                                <option value="2">Pay two months after period end</option>
                            </select>
                        </div>
                        <div className="mt-3 text-sm text-ink-200">
                            Example: 23 Aug to 22 Sep, pay on 7 Oct.
                        </div>
                    </div>
                    <button type="submit" className="rounded-full bg-white px-5 py-3 font-medium text-ink-900">Save organisation settings</button>
                </form>
            </section>

            <section className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Organisation snapshot</div>
                    <div className="mt-4 text-white">
                        <div className="text-2xl font-semibold">{organisation?.name || 'No organisation loaded'}</div>
                        <div className="mt-2 text-sm text-ink-200">{organisation?.officeAddress || 'Configure office location, payroll rules, and attendance policies here.'}</div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Shifts</div>
                        <form onSubmit={shiftForm.handleSubmit(saveShift)} className="mt-4 space-y-3">
                            <input {...shiftForm.register('id')} type="hidden" />
                            <input {...shiftForm.register('name')} placeholder="Shift name" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input {...shiftForm.register('startTime')} type="time" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                                <input {...shiftForm.register('endTime')} type="time" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input {...shiftForm.register('breakDurationMinutes')} type="number" placeholder="Break minutes" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                                <input {...shiftForm.register('requiredWorkingHours')} type="number" placeholder="Required hours" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input {...shiftForm.register('graceTimeMinutes')} type="number" placeholder="Grace minutes" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                                <input {...shiftForm.register('overtimeThresholdMinutes')} type="number" placeholder="Overtime threshold" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <select {...shiftForm.register('overnightShift')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                    <option value="false">Not overnight</option>
                                    <option value="true">Overnight</option>
                                </select>
                                <select {...shiftForm.register('isActive')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                            <button type="submit" className="rounded-full bg-white px-5 py-3 font-medium text-ink-900">
                                {shiftForm.watch('id') ? 'Update shift' : 'Create shift'}
                            </button>
                        </form>
                        <div className="mt-5 space-y-3 text-sm text-ink-200">
                            {shifts.length ? shifts.map((shift) => (
                                <div key={shift.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-white">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium">{shift.name}</div>
                                            <div className="text-xs uppercase tracking-[0.3em] text-ink-300">{shift.startTime} - {shift.endTime}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => editShift(shift)} className="rounded-full border border-white/10 px-3 py-1 text-xs">Edit</button>
                                            <button type="button" onClick={() => removeShift(shift.id)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-red-200">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            )) : <div>No shifts loaded.</div>}
                        </div>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                        <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Branches</div>
                        <form onSubmit={branchForm.handleSubmit(saveBranch)} className="mt-4 space-y-3">
                            <input {...branchForm.register('id')} type="hidden" />
                            <input {...branchForm.register('name')} placeholder="Branch name" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <input {...branchForm.register('code')} placeholder="Branch code" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <input {...branchForm.register('address')} placeholder="Branch address" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input {...branchForm.register('latitude')} placeholder="Latitude" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                                <input {...branchForm.register('longitude')} placeholder="Longitude" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input {...branchForm.register('radiusMetres')} type="number" placeholder="Radius metres" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                                <select {...branchForm.register('isActive')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                            <button type="submit" className="rounded-full bg-white px-5 py-3 font-medium text-ink-900">
                                {branchForm.watch('id') ? 'Update branch' : 'Create branch'}
                            </button>
                        </form>
                        <div className="mt-5 space-y-3 text-sm text-ink-200">
                            {branches.length ? branches.map((branch) => (
                                <div key={branch.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-white">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium">{branch.name}</div>
                                            <div className="text-xs uppercase tracking-[0.3em] text-ink-300">{branch.code || 'No code'}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => editBranch(branch)} className="rounded-full border border-white/10 px-3 py-1 text-xs">Edit</button>
                                            <button type="button" onClick={() => removeBranch(branch.id)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-red-200">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            )) : <div>No branches loaded.</div>}
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Office network policy</div>
                    <h3 className="mt-3 text-2xl font-semibold text-white">Approved kiosk networks</h3>
                    <p className="mt-2 text-sm text-ink-200">
                        Browsers cannot read the Wi-Fi name directly, so kiosk access is enforced using approved office public IP addresses together with branch geolocation.
                    </p>
                    <form onSubmit={approvedIpForm.handleSubmit(saveApprovedIpAddress)} className="mt-4 grid gap-3 md:grid-cols-2">
                        <input {...approvedIpForm.register('id')} type="hidden" />
                        <input {...approvedIpForm.register('ipAddress')} placeholder="Public IP address" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                        <input {...approvedIpForm.register('description')} placeholder="Description (Office Wi-Fi, Reception kiosk)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                        <select {...approvedIpForm.register('branchId')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                            <option value="">All branches</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                        <select {...approvedIpForm.register('isActive')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                        <button type="submit" className="rounded-full bg-white px-5 py-3 font-medium text-ink-900 md:col-span-2">
                            {approvedIpForm.watch('id') ? 'Update office network' : 'Add office network'}
                        </button>
                    </form>
                    <div className="mt-5 space-y-3 text-sm text-ink-200">
                        {approvedIpAddresses.length ? approvedIpAddresses.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-white">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-medium">{entry.ipAddress}</div>
                                        <div className="text-xs uppercase tracking-[0.3em] text-ink-300">
                                            {branches.find((branch) => Number(branch.id) === Number(entry.branchId))?.name || 'All branches'}
                                        </div>
                                        <div className="mt-2 text-sm text-ink-200">{entry.description || 'No description'}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => editApprovedIpAddress(entry)} className="rounded-full border border-white/10 px-3 py-1 text-xs">Edit</button>
                                        <button type="button" onClick={() => removeApprovedIpAddress(entry.id)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-red-200">Delete</button>
                                    </div>
                                </div>
                            </div>
                        )) : <div>No office network restrictions configured yet.</div>}
                    </div>
                </div>
            </section>
        </div>
    );
}
