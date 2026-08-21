import { asyncHandler } from '../utils/asyncHandler.js';
import { identifyFace } from '../services/faceService.js';
import { buildCheckInResult, buildCheckOutResult } from '../services/attendanceService.js';
import { models } from '../models/store.js';

function getRequestIp(request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }

    return request.ip;
}

async function resolveShift(employee) {
    if (!employee?.shiftId) {
        return null;
    }

    return models.Shift.findByPk(employee.shiftId);
}

async function resolveBranch(employee) {
    if (!employee?.branchId) {
        return null;
    }

    return models.Branch.findByPk(employee.branchId);
}

async function resolveTodaySummary(employeeId) {
    const summaryDate = new Date().toISOString().slice(0, 10);
    return models.AttendanceSummary.findOne({
        where: { employeeId, attendanceDate: summaryDate }
    });
}

function buildAttendanceState(summary) {
    return {
        hasCheckedIn: Boolean(summary?.firstCheckIn),
        hasCheckedOut: Boolean(summary?.lastCheckOut),
        actionMode: summary?.firstCheckIn && !summary?.lastCheckOut ? 'CHECK_OUT' : 'CHECK_IN'
    };
}

function buildAttendanceEmployee(employee, branch) {
    return {
        ...employee.toJSON(),
        branchLatitude: branch?.latitude ?? null,
        branchLongitude: branch?.longitude ?? null,
        branchRadiusMetres: branch?.radiusMetres ?? null
    };
}

async function resolveOfficeIpPolicy(employee, request) {
    const currentIp = getRequestIp(request);
    const [branchSpecificAddresses, organisationWideAddresses] = await Promise.all([
        employee.branchId
            ? models.ApprovedIpAddress.findAll({
                where: {
                    organisationId: employee.organisationId,
                    branchId: employee.branchId
                }
            })
            : Promise.resolve([]),
        models.ApprovedIpAddress.findAll({
            where: {
                organisationId: employee.organisationId,
                branchId: null
            }
        })
    ]);
    const approvedIpAddresses = [...organisationWideAddresses, ...branchSpecificAddresses];

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

async function identifyEmployeeFromFace(liveImage) {
    const faceMatch = await identifyFace({
        image: liveImage,
        threshold: 0.4,
        detector: 'opencv',
        modelName: 'Facenet512'
    });

    if (!faceMatch?.verified || !faceMatch?.employeeId) {
        return null;
    }

    return faceMatch;
}

async function resolveEmployeeFromFaceMatch(faceMatch) {
    if (!faceMatch?.employeeId) {
        return null;
    }

    const employeeIdentifier = String(faceMatch.employeeId).trim();

    if (/^\d+$/.test(employeeIdentifier)) {
        const byPrimaryKey = await models.Employee.findByPk(Number(employeeIdentifier));
        if (byPrimaryKey) {
            return byPrimaryKey;
        }
    }

    return models.Employee.findOne({
        where: {
            employeeCode: employeeIdentifier
        }
    });
}

async function markAttendance(request, response, actionType) {
    const { liveImage, geoLocation = {}, requestMeta = {} } = request.body;
    const faceMatch = await identifyEmployeeFromFace(liveImage);

    if (!faceMatch) {
        return response.status(422).json({ message: 'Face could not be identified' });
    }

    const employee = await resolveEmployeeFromFaceMatch(faceMatch);
    if (!employee) {
        return response.status(404).json({ message: 'Employee profile not found' });
    }

    const branch = await resolveBranch(employee);
    const shift = await resolveShift(employee);
    const officeIpPolicy = await resolveOfficeIpPolicy(employee, request);
    const result = await buildCheckInResult({
        employee: buildAttendanceEmployee(employee, branch),
        shift,
        liveImage,
        geo: geoLocation,
        officeIp: officeIpPolicy,
        requestMeta,
        faceVerification: faceMatch
    });

    if (actionType === 'CHECK_IN') {
        const event = await models.AttendanceEvent.create({
            employeeId: employee.id,
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
            where: { employeeId: employee.id, attendanceDate: summaryDate },
            defaults: {
                employeeId: employee.id,
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

        return response.status(201).json({
            message: 'Check-in recorded',
            employee: {
                id: employee.id,
                fullName: employee.fullName,
                employeeCode: employee.employeeCode,
                branchId: employee.branchId,
                branchName: branch?.name || null
            },
            event,
            summary,
            attendanceState: buildAttendanceState(summary),
            faceMatch
        });
    }

    if (result.validation.validationStatus !== 'PASSED') {
        const event = await models.AttendanceEvent.create({
            employeeId: employee.id,
            eventType: 'CHECK_OUT',
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

        return response.status(422).json({ message: result.validation.failureReason, event, result });
    }

    const summaryDate = new Date().toISOString().slice(0, 10);
    const summary = await models.AttendanceSummary.findOne({ where: { employeeId: employee.id, attendanceDate: summaryDate } });
    if (!summary) {
        return response.status(404).json({ message: 'Attendance summary not found for today' });
    }

    summary.lastCheckOut = new Date();
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
        employeeId: employee.id,
        eventType: 'CHECK_OUT',
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

    return response.json({
        message: 'Check-out recorded',
        employee: {
            id: employee.id,
            fullName: employee.fullName,
            employeeCode: employee.employeeCode,
            branchId: employee.branchId,
            branchName: branch?.name || null
        },
        event,
        summary,
        attendanceState: buildAttendanceState(summary),
        calculation,
        faceMatch
    });
}

export const identify = asyncHandler(async (request, response) => {
    const { liveImage } = request.body;
    const faceMatch = await identifyEmployeeFromFace(liveImage);

    if (!faceMatch) {
        return response.status(422).json({ message: 'Face could not be identified' });
    }

    const employee = await resolveEmployeeFromFaceMatch(faceMatch);
    if (!employee) {
        return response.status(404).json({ message: 'Employee profile not found' });
    }

    const branch = await resolveBranch(employee);
    const officeIpPolicy = await resolveOfficeIpPolicy(employee, request);
    const todaySummary = await resolveTodaySummary(employee.id);

    return response.json({
        employee: {
            id: employee.id,
            fullName: employee.fullName,
            employeeCode: employee.employeeCode,
            branchId: employee.branchId,
            branchName: branch?.name || null,
            departmentId: employee.departmentId,
            shiftId: employee.shiftId
        },
        faceMatch,
        summary: todaySummary,
        attendanceState: buildAttendanceState(todaySummary),
        policy: {
            officeIpRequired: officeIpPolicy.required,
            officeIpVerified: officeIpPolicy.verified,
            currentIp: officeIpPolicy.ipAddress,
            branch: branch ? {
                id: branch.id,
                name: branch.name,
                latitude: branch.latitude,
                longitude: branch.longitude,
                radiusMetres: branch.radiusMetres
            } : null
        }
    });
});

export const publicCheckIn = asyncHandler(async (request, response) => {
    return markAttendance(request, response, 'CHECK_IN');
});

export const publicCheckOut = asyncHandler(async (request, response) => {
    return markAttendance(request, response, 'CHECK_OUT');
});
