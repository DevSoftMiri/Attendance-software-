import { asyncHandler } from '../utils/asyncHandler.js';
import { buildCheckInResult, buildCheckOutResult } from '../services/attendanceService.js';
import { buildAttendanceState, resolveAttendanceLeaveWindow, resolveAttendanceStatus } from '../services/leaveAttendanceService.js';
import { models } from '../models/store.js';

async function resolveEmployee(employeeId) {
    return models.Employee.findByPk(employeeId);
}

async function resolveOrganisation(organisationId) {
    if (!organisationId) {
        return null;
    }

    return models.Organisation.findByPk(organisationId);
}

function getRequestIp(request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }

    return request.ip;
}

async function resolveOfficeIpPolicy(employee, request) {
    const currentIp = getRequestIp(request);
    const approvedIpAddresses = await models.ApprovedIpAddress.findAll({
        where: {
            organisationId: employee.organisationId,
            ...(employee.branchId ? { branchId: employee.branchId } : {})
        }
    });

    if (!approvedIpAddresses.length) {
        return { ipAddress: currentIp, verified: true, required: false };
    }

    const verified = approvedIpAddresses.some((entry) => entry.ipAddress === currentIp && entry.isActive !== false);
    return {
        ipAddress: currentIp,
        verified,
        required: true,
        approvedIpAddresses: approvedIpAddresses.map((entry) => entry.ipAddress)
    };
}

async function resolveShift(employee) {
    if (!employee?.shiftId) {
        return null;
    }

    return models.Shift.findByPk(employee.shiftId);
}

function buildAttendanceEmployee(employee, organisation) {
    return {
        ...employee.toJSON(),
        officeLatitude: organisation?.officeGeo?.latitude ?? null,
        officeLongitude: organisation?.officeGeo?.longitude ?? null,
        officeRadiusMetres: organisation?.attendancePolicies?.geofenceRadius ?? null
    };
}

export const checkIn = asyncHandler(async (request, response) => {
    const { employeeId, liveImage, geoLocation = {}, requestMeta = {}, officeIp = {} } = request.body;
    const employee = await resolveEmployee(employeeId);

    if (!employee) {
        return response.status(404).json({ message: 'Employee not found' });
    }

    const shift = await resolveShift(employee);
    const organisation = await resolveOrganisation(employee.organisationId);
    const summaryDate = new Date().toISOString().slice(0, 10);
    const { effectiveWindow } = await resolveAttendanceLeaveWindow({ employee, shift, attendanceDate: summaryDate });
    const officeIpPolicy = await resolveOfficeIpPolicy(employee, request);
    const result = await buildCheckInResult({
        employee: buildAttendanceEmployee(employee, organisation),
        shift,
        liveImage,
        geo: geoLocation,
        officeIp: officeIpPolicy,
        requestMeta,
        effectiveWindow
    });
    const event = await models.AttendanceEvent.create({
        employeeId,
        eventType: 'CHECK_IN',
        serverTimestamp: new Date(),
        deviceTimestamp: requestMeta.deviceTimestamp || null,
        latitude: geoLocation.latitude || null,
        longitude: geoLocation.longitude || null,
        locationAccuracy: geoLocation.accuracy || null,
        distanceFromOffice: result.distanceFromOffice || null,
        publicIp: officeIpPolicy.ipAddress,
        officeIpVerified: Boolean(result.validation.officeIpVerified),
        faceVerified: Boolean(result.validation.faceVerified),
        antiSpoofingPassed: Boolean(result.validation.antiSpoofingPassed),
        faceDistance: result.validation.faceDistance,
        faceThreshold: result.validation.faceThreshold,
        deviceInformation: requestMeta.deviceInformation || {},
        browserInformation: requestMeta.browserInformation || {},
        validationStatus: result.validation.validationStatus,
        failureReason: result.validation.failureReason
    });

    if (result.validation.validationStatus !== 'PASSED') {
        return response.status(422).json({ message: result.validation.failureReason, event, result });
    }

    const [summary] = await models.AttendanceSummary.findOrCreate({
        where: { employeeId, attendanceDate: summaryDate },
        defaults: {
            employeeId,
            attendanceDate: summaryDate,
            shiftId: employee.shiftId || null,
            firstCheckIn: new Date(),
            lateMinutes: result.lateMinutes,
            attendanceStatus: resolveAttendanceStatus({ effectiveWindow, lateMinutes: result.lateMinutes }),
            appliedLeaveRequestId: effectiveWindow.leaveRequestId,
            appliedLeaveMode: effectiveWindow.leaveMode,
            expectedCheckInTime: effectiveWindow.expectedCheckInTime,
            expectedCheckOutTime: effectiveWindow.expectedCheckOutTime
        }
    });

    if (!summary.firstCheckIn) {
        summary.firstCheckIn = new Date();
    }
    summary.shiftId = employee.shiftId || null;
    summary.lateMinutes = result.lateMinutes;
    summary.attendanceStatus = resolveAttendanceStatus({ effectiveWindow, lateMinutes: result.lateMinutes });
    summary.appliedLeaveRequestId = effectiveWindow.leaveRequestId;
    summary.appliedLeaveMode = effectiveWindow.leaveMode;
    summary.expectedCheckInTime = effectiveWindow.expectedCheckInTime;
    summary.expectedCheckOutTime = effectiveWindow.expectedCheckOutTime;
    await summary.save();

    return response.status(201).json({ message: 'Check-in recorded', event, summary, result, attendanceState: buildAttendanceState(summary, effectiveWindow) });
});

export const checkOut = asyncHandler(async (request, response) => {
    const { employeeId, requestMeta = {} } = request.body;
    const employee = await resolveEmployee(employeeId);

    if (!employee) {
        return response.status(404).json({ message: 'Employee not found' });
    }

    const summaryDate = new Date().toISOString().slice(0, 10);
    const summary = await models.AttendanceSummary.findOne({ where: { employeeId, attendanceDate: summaryDate } });
    if (!summary) {
        return response.status(404).json({ message: 'Attendance summary not found for today' });
    }

    summary.lastCheckOut = new Date();
    const shift = await resolveShift(employee);
    const { effectiveWindow } = await resolveAttendanceLeaveWindow({ employee, shift, attendanceDate: summaryDate });
    const calculation = buildCheckOutResult({
        shift,
        loginTime: employee.loginTime,
        checkInAt: summary.firstCheckIn,
        checkOutAt: summary.lastCheckOut,
        effectiveWindow
    });
    summary.totalWorkingMinutes = calculation.totalWorkingMinutes;
    summary.lateMinutes = calculation.lateMinutes;
    summary.earlyLogoutMinutes = calculation.earlyLogoutMinutes;
    summary.overtimeMinutes = calculation.overtimeMinutes;
    summary.attendanceStatus = resolveAttendanceStatus({ effectiveWindow, lateMinutes: calculation.lateMinutes });
    summary.appliedLeaveRequestId = effectiveWindow.leaveRequestId;
    summary.appliedLeaveMode = effectiveWindow.leaveMode;
    summary.expectedCheckInTime = effectiveWindow.expectedCheckInTime;
    summary.expectedCheckOutTime = effectiveWindow.expectedCheckOutTime;
    await summary.save();

    const event = await models.AttendanceEvent.create({
        employeeId,
        eventType: 'CHECK_OUT',
        serverTimestamp: new Date(),
        deviceTimestamp: requestMeta.deviceTimestamp || null,
        deviceInformation: requestMeta.deviceInformation || {},
        browserInformation: requestMeta.browserInformation || {},
        validationStatus: 'PASSED'
    });

    return response.json({ message: 'Check-out recorded', event, summary, calculation, attendanceState: buildAttendanceState(summary, effectiveWindow) });
});

export const history = asyncHandler(async (request, response) => {
    const employeeId = request.query.employeeId || request.user?.employeeId;
    const events = await models.AttendanceEvent.findAll({
        where: employeeId ? { employeeId } : {},
        order: [['createdAt', 'DESC']],
        limit: 100
    });

    let todaySummary = null;
    let attendanceState = null;
    if (employeeId) {
        const employee = await resolveEmployee(employeeId);
        if (employee) {
            const today = new Date().toISOString().slice(0, 10);
            todaySummary = await models.AttendanceSummary.findOne({ where: { employeeId, attendanceDate: today } });
            const shift = await resolveShift(employee);
            const { effectiveWindow } = await resolveAttendanceLeaveWindow({ employee, shift, attendanceDate: today });
            attendanceState = buildAttendanceState(todaySummary, effectiveWindow);
        }
    }

    return response.json({ events, todaySummary, attendanceState });
});
