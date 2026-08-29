import { asyncHandler } from '../utils/asyncHandler.js';
import { identifyFace } from '../services/faceService.js';
import { buildCheckInResult, buildCheckOutResult } from '../services/attendanceService.js';
import { buildAttendanceState, resolveAttendanceLeaveWindow, resolveAttendanceStatus } from '../services/leaveAttendanceService.js';
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

async function resolveOrganisation(organisationId) {
    if (!organisationId) {
        return null;
    }

    return models.Organisation.findByPk(organisationId);
}

async function resolveTodaySummary(employeeId) {
    const summaryDate = new Date().toISOString().slice(0, 10);
    return models.AttendanceSummary.findOne({
        where: { employeeId, attendanceDate: summaryDate }
    });
}

function buildAttendanceEmployee(employee, branch, organisation) {
    return {
        ...employee.toJSON(),
        officeLatitude: organisation?.officeGeo?.latitude ?? null,
        officeLongitude: organisation?.officeGeo?.longitude ?? null,
        officeRadiusMetres: organisation?.attendancePolicies?.geofenceRadius ?? null,
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

    if (!faceMatch?.verified || !faceMatch?.employeeId) {
        return response.status(422).json({ message: faceMatch?.detail || 'Face could not be identified' });
    }

    const employee = await resolveEmployeeFromFaceMatch(faceMatch);
    if (!employee) {
        return response.status(422).json({ message: 'Matched face profile does not map to an active employee' });
    }

    const [branch, organisation] = await Promise.all([
        resolveBranch(employee),
        resolveOrganisation(employee.organisationId)
    ]);
    const shift = await resolveShift(employee);
    const summaryDate = new Date().toISOString().slice(0, 10);
    const { effectiveWindow } = await resolveAttendanceLeaveWindow({ employee, shift, attendanceDate: summaryDate });
    const officeIpPolicy = await resolveOfficeIpPolicy(employee, request);
    const result = await buildCheckInResult({
        employee: buildAttendanceEmployee(employee, branch, organisation),
        shift,
        liveImage,
        geo: geoLocation,
        officeIp: officeIpPolicy,
        requestMeta,
        faceVerification: faceMatch,
        effectiveWindow
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

        const [summary] = await models.AttendanceSummary.findOrCreate({
            where: { employeeId: employee.id, attendanceDate: summaryDate },
            defaults: {
                employeeId: employee.id,
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
            attendanceState: buildAttendanceState(summary, effectiveWindow),
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

    const summary = await models.AttendanceSummary.findOne({ where: { employeeId: employee.id, attendanceDate: summaryDate } });
    if (!summary) {
        return response.status(404).json({ message: 'Attendance summary not found for today' });
    }

    summary.lastCheckOut = new Date();
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
        attendanceState: buildAttendanceState(summary, effectiveWindow),
        calculation,
        faceMatch
    });
}

export const identify = asyncHandler(async (request, response) => {
    const { liveImage } = request.body;
    const faceMatch = await identifyEmployeeFromFace(liveImage);

    if (!faceMatch?.verified || !faceMatch?.employeeId) {
        return response.status(422).json({ message: faceMatch?.detail || 'Face could not be identified' });
    }

    const employee = await resolveEmployeeFromFaceMatch(faceMatch);
    if (!employee) {
        return response.status(422).json({ message: 'Matched face profile does not map to an active employee' });
    }

    const [branch, organisation] = await Promise.all([
        resolveBranch(employee),
        resolveOrganisation(employee.organisationId)
    ]);
    const officeIpPolicy = await resolveOfficeIpPolicy(employee, request);
    const todaySummary = await resolveTodaySummary(employee.id);
    const shift = await resolveShift(employee);
    const { effectiveWindow } = await resolveAttendanceLeaveWindow({
        employee,
        shift,
        attendanceDate: new Date().toISOString().slice(0, 10)
    });

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
        attendanceState: buildAttendanceState(todaySummary, effectiveWindow),
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
            } : null,
            office: organisation?.officeGeo ? {
                latitude: organisation.officeGeo.latitude,
                longitude: organisation.officeGeo.longitude,
                radiusMetres: organisation?.attendancePolicies?.geofenceRadius ?? 150
            } : null
        },
        effectiveWindow: {
            leaveRequestId: effectiveWindow.leaveRequestId,
            leaveMode: effectiveWindow.leaveMode,
            expectedCheckInTime: effectiveWindow.expectedCheckInTime,
            expectedCheckOutTime: effectiveWindow.expectedCheckOutTime,
            expectedWorkingMinutes: effectiveWindow.expectedWorkingMinutes,
            windowLabel: effectiveWindow.windowLabel
        }
    });
});

export const publicCheckIn = asyncHandler(async (request, response) => {
    return markAttendance(request, response, 'CHECK_IN');
});

export const publicCheckOut = asyncHandler(async (request, response) => {
    return markAttendance(request, response, 'CHECK_OUT');
});
