import { asyncHandler } from '../utils/asyncHandler.js';
import { buildCheckInResult, buildCheckOutResult } from '../services/attendanceService.js';
import { models } from '../models/store.js';

async function resolveEmployee(employeeId) {
    return models.Employee.findByPk(employeeId);
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

export const checkIn = asyncHandler(async (request, response) => {
    const { employeeId, liveImage, geoLocation = {}, requestMeta = {}, officeIp = {} } = request.body;
    const employee = await resolveEmployee(employeeId);

    if (!employee) {
        return response.status(404).json({ message: 'Employee not found' });
    }

    const shift = await resolveShift(employee);
    const officeIpPolicy = await resolveOfficeIpPolicy(employee, request);
    const result = await buildCheckInResult({ employee, shift, liveImage, geo: geoLocation, officeIp: officeIpPolicy, requestMeta });
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

    const summaryDate = new Date().toISOString().slice(0, 10);
    const [summary] = await models.AttendanceSummary.findOrCreate({
        where: { employeeId, attendanceDate: summaryDate },
        defaults: {
            employeeId,
            attendanceDate: summaryDate,
            shiftId: employee.shiftId || null,
            firstCheckIn: new Date(),
            attendanceStatus: 'PRESENT'
        }
    });

    if (!summary.firstCheckIn) {
        summary.firstCheckIn = new Date();
    }
    summary.shiftId = employee.shiftId || null;
    summary.attendanceStatus = 'PRESENT';
    await summary.save();

    return response.status(201).json({ message: 'Check-in recorded', event, summary, result });
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
    const calculation = buildCheckOutResult({
        shift,
        loginTime: employee.loginTime,
        checkInAt: summary.firstCheckIn,
        checkOutAt: summary.lastCheckOut
    });
    summary.totalWorkingMinutes = calculation.totalWorkingMinutes;
    summary.lateMinutes = calculation.lateMinutes;
    summary.earlyLogoutMinutes = calculation.earlyLogoutMinutes;
    summary.overtimeMinutes = calculation.overtimeMinutes;
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

    return response.json({ message: 'Check-out recorded', event, summary, calculation });
});

export const history = asyncHandler(async (request, response) => {
    const employeeId = request.query.employeeId || request.user?.employeeId;
    const events = await models.AttendanceEvent.findAll({
        where: employeeId ? { employeeId } : {},
        order: [['createdAt', 'DESC']],
        limit: 100
    });

    return response.json({ events });
});
