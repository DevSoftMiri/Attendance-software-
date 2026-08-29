import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../services/api';
import { captureCurrentLocation } from '../utils/attendance';

function buildOrganisationFormValues(organisation) {
    if (!organisation) {
        return {};
    }

    return {
        ...organisation,
        officeLatitude: organisation.officeGeo?.latitude ?? '',
        officeLongitude: organisation.officeGeo?.longitude ?? '',
        officeLocationAccuracy: organisation.officeGeo?.accuracy ?? '',
        geofenceRadius: organisation.attendancePolicies?.geofenceRadius ?? 150,
        maxLateArrivalMinutes: organisation.attendancePolicies?.maxLateArrivalMinutes ?? 0,
        carryForwardUnusedPaidLeave: String(organisation.attendancePolicies?.carryForwardUnusedPaidLeave !== false),
        standardWorkingHoursPerDay: organisation.payrollSettings?.standardWorkingHoursPerDay ?? 8,
        graceMinutes: organisation.payrollSettings?.graceMinutes ?? 15,
        halfDayMinimumMinutes: organisation.payrollSettings?.halfDayMinimumMinutes ?? 240,
        overtimeEnabled: String(organisation.payrollSettings?.overtimeEnabled !== false),
        overtimeMinimumMinutes: organisation.payrollSettings?.overtimeMinimumMinutes ?? 0,
        overtimeRateType: organisation.payrollSettings?.overtimeRateType ?? 'fixed',
        salaryCalculationMethod: organisation.payrollSettings?.salaryCalculationMethod ?? 'working-days',
        holidaysPaid: String(organisation.payrollSettings?.holidaysPaid !== false),
        weekOffPaid: String(organisation.payrollSettings?.weekOffPaid !== false),
        shortHoursDeductionEnabled: String(organisation.payrollSettings?.shortHoursDeductionEnabled !== false),
        shortHoursDeductionMethod: organisation.payrollSettings?.shortHoursDeductionMethod ?? 'accumulated',
        periodStartDay: organisation.payrollSettings?.periodStartDay ?? 1,
        periodEndDay: organisation.payrollSettings?.periodEndDay ?? 31,
        periodEndMonthOffset: organisation.payrollSettings?.periodEndMonthOffset ?? 0,
        payDayOfMonth: organisation.payrollSettings?.payDayOfMonth ?? 7,
        payMonthOffset: organisation.payrollSettings?.payMonthOffset ?? 1
    };
}

export default function SettingsPage() {
    const organisationForm = useForm();
    const shiftForm = useForm({
        defaultValues: {
            name: 'General Shift',
            startTime: '',
            endTime: '',
            breakDurationMinutes: 0,
            requiredWorkingHours: 8,
            graceTimeMinutes: 0,
            overtimeThresholdMinutes: 0,
            overnightShift: 'false',
            isActive: 'true'
        }
    });
    const approvedIpForm = useForm({ defaultValues: { isActive: 'true' } });
    const [organisation, setOrganisation] = useState(null);
    const [shifts, setShifts] = useState([]);
    const [approvedIpAddresses, setApprovedIpAddresses] = useState([]);
    const [locationLoading, setLocationLoading] = useState(false);

    async function loadSettings() {
        try {
            const { data } = await api.get('/settings');
            setOrganisation(data.organisation || null);
            setShifts(data.shifts || []);
            setApprovedIpAddresses(data.approvedIpAddresses || []);

            if (data.organisation) {
                organisationForm.reset(buildOrganisationFormValues(data.organisation));
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
            const hasOfficeCoordinates = values.officeLatitude !== '' && values.officeLongitude !== '';
            const payload = {
                id: organisation?.id || 1,
                name: values.name,
                initial: values.initial,
                officeAddress: values.officeAddress,
                officeGeo: hasOfficeCoordinates ? {
                    latitude: Number(values.officeLatitude),
                    longitude: Number(values.officeLongitude),
                    accuracy: values.officeLocationAccuracy === '' ? null : Number(values.officeLocationAccuracy),
                    updatedAt: new Date().toISOString()
                } : null,
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
            organisationForm.reset(buildOrganisationFormValues(data.organisation));
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

    async function saveApprovedIpAddress(values) {
        try {
            const payload = {
                ...values,
                organisationId: organisation?.id || 1,
                branchId: null,
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

    function resetShiftFormToSingleShift() {
        shiftForm.reset({
            name: 'General Shift',
            startTime: '',
            endTime: '',
            breakDurationMinutes: 0,
            requiredWorkingHours: 8,
            graceTimeMinutes: 0,
            overtimeThresholdMinutes: 0,
            overnightShift: 'false',
            isActive: 'true'
        });
    }

    function editApprovedIpAddress(entry) {
        approvedIpForm.reset({
            id: entry.id,
            ipAddress: entry.ipAddress,
            description: entry.description,
            isActive: String(Boolean(entry.isActive))
        });
    }

    async function setOfficeLiveLocation() {
        setLocationLoading(true);
        try {
            const location = await captureCurrentLocation();
            if (!location) {
                toast.error('Unable to access current location');
                return;
            }

            organisationForm.setValue('officeLatitude', String(location.latitude), { shouldDirty: true });
            organisationForm.setValue('officeLongitude', String(location.longitude), { shouldDirty: true });
            organisationForm.setValue('officeLocationAccuracy', String(Math.round(location.accuracy || 0)), { shouldDirty: true });
            toast.success('Live office location captured');
        } finally {
            setLocationLoading(false);
        }
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
                    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Office live location</div>
                                <div className="mt-1 text-sm text-ink-200">Save one office geofence for attendance. Branch setup is not required.</div>
                            </div>
                            <button
                                type="button"
                                onClick={setOfficeLiveLocation}
                                disabled={locationLoading}
                                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                                {locationLoading ? 'Fetching location...' : 'Use current location'}
                            </button>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <input {...organisationForm.register('officeLatitude')} placeholder="Latitude" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <input {...organisationForm.register('officeLongitude')} placeholder="Longitude" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                            <input {...organisationForm.register('officeLocationAccuracy')} type="number" min="0" placeholder="Accuracy (m)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                        </div>
                    </div>
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
                        <div className="mt-3 text-sm text-ink-200">
                            {organisation?.officeGeo?.latitude && organisation?.officeGeo?.longitude
                                ? `${Number(organisation.officeGeo.latitude).toFixed(5)}, ${Number(organisation.officeGeo.longitude).toFixed(5)}`
                                : 'Office live location not saved yet.'}
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Shifts</div>
                    <p className="mt-3 text-sm text-ink-200">
                        If your company has only one shift, keep one active 8-hour shift here and assign the same shift to all employees.
                    </p>
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
                        <button type="button" onClick={resetShiftFormToSingleShift} className="rounded-full border border-white/15 bg-white/5 px-5 py-3 font-medium text-white">
                            Use 8-hour template
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
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-4">
                                No shifts loaded. Create one active 8-hour shift for your company schedule.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft">
                    <div className="text-xs uppercase tracking-[0.35em] text-ink-300">Office network policy</div>
                    <h3 className="mt-3 text-2xl font-semibold text-white">Approved kiosk networks</h3>
                    <p className="mt-2 text-sm text-ink-200">
                        Browsers cannot read the Wi-Fi name directly, so kiosk access is enforced using approved office public IP addresses together with your saved office geofence.
                    </p>
                    <form onSubmit={approvedIpForm.handleSubmit(saveApprovedIpAddress)} className="mt-4 grid gap-3 md:grid-cols-2">
                        <input {...approvedIpForm.register('id')} type="hidden" />
                        <input {...approvedIpForm.register('ipAddress')} placeholder="Public IP address" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
                        <input {...approvedIpForm.register('description')} placeholder="Description (Office Wi-Fi, Reception kiosk)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-ink-400" />
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
                                        <div className="text-xs uppercase tracking-[0.3em] text-ink-300">Office-wide</div>
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
