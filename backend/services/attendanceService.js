import { evaluateAttendanceWindow, evaluateAttendanceWindowWithExpectations } from '../utils/attendanceCalculator.js';
import { verifyFace } from './faceService.js';

export async function buildCheckInResult({ employee, shift, liveImage, geo, officeIp, requestMeta, faceVerification: providedFaceVerification = null, effectiveWindow = null }) {
    const faceVerification = providedFaceVerification || await verifyFace({
        employeeId: employee.id,
        image: liveImage,
        threshold: 0.4,
        detector: 'opencv'
    });

    const validation = {
        faceVerified: Boolean(faceVerification?.verified),
        antiSpoofingPassed: Boolean(faceVerification?.antiSpoofingPassed ?? true),
        faceDistance: faceVerification?.distance ?? null,
        faceThreshold: faceVerification?.threshold ?? 0.4,
        officeIpVerified: Boolean(officeIp?.verified),
        validationStatus: 'FAILED',
        failureReason: null
    };

    if (!validation.faceVerified) {
        validation.failureReason = 'Face verification failed';
        return { validation };
    }

    const officeLatitude = Number(employee.officeLatitude || employee.branchLatitude || employee.latitude || 0);
    const officeLongitude = Number(employee.officeLongitude || employee.branchLongitude || employee.longitude || 0);
    const radius = Number(employee.officeRadiusMetres || employee.branchRadiusMetres || employee.radiusMetres || 150);
    const latitude = Number(geo?.latitude || 0);
    const longitude = Number(geo?.longitude || 0);
    const accuracy = Number(geo?.accuracy || 0);

    const distanceFromOffice = officeLatitude && officeLongitude ? haversineDistance(officeLatitude, officeLongitude, latitude, longitude) : null;
    const geoAccepted = distanceFromOffice === null || distanceFromOffice <= radius;
    const accuracyAccepted = !accuracy || accuracy <= Number(employee.maxGpsAccuracyMetres || 150);

    if (!geoAccepted) {
        validation.failureReason = 'Outside office geofence';
        return { validation, distanceFromOffice };
    }

    if (!accuracyAccepted) {
        validation.failureReason = 'GPS accuracy too low';
        return { validation, distanceFromOffice };
    }

    if (officeIp?.required && !officeIp?.verified) {
        validation.failureReason = 'Office IP not approved';
        return { validation, distanceFromOffice };
    }

    validation.validationStatus = 'PASSED';
    const window = effectiveWindow
        ? evaluateAttendanceWindowWithExpectations({
            checkInAt: new Date().toISOString(),
            checkOutAt: null,
            expectedCheckInTime: effectiveWindow.expectedCheckInTime,
            expectedCheckOutTime: effectiveWindow.expectedCheckOutTime
        })
        : evaluateAttendanceWindow({
            shift,
            loginTime: employee?.loginTime,
            checkInAt: new Date().toISOString(),
            checkOutAt: null
        });

    return {
        validation,
        distanceFromOffice,
        officeLatitude,
        officeLongitude,
        requestMeta,
        effectiveWindow: effectiveWindow ? {
            leaveRequestId: effectiveWindow.leaveRequestId,
            leaveMode: effectiveWindow.leaveMode,
            expectedCheckInTime: effectiveWindow.expectedCheckInTime,
            expectedCheckOutTime: effectiveWindow.expectedCheckOutTime,
            expectedWorkingMinutes: effectiveWindow.expectedWorkingMinutes,
            windowLabel: effectiveWindow.windowLabel
        } : null,
        ...window,
        faceVerification
    };
}

export function buildCheckOutResult({ shift, loginTime, checkInAt, checkOutAt, effectiveWindow = null }) {
    return effectiveWindow
        ? evaluateAttendanceWindowWithExpectations({
            checkInAt,
            checkOutAt,
            expectedCheckInTime: effectiveWindow.expectedCheckInTime,
            expectedCheckOutTime: effectiveWindow.expectedCheckOutTime
        })
        : evaluateAttendanceWindow({ shift, loginTime, checkInAt, checkOutAt });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    function toRadians(value) {
        return (value * Math.PI) / 180;
    }

    const earthRadius = 6371000;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadius * c);
}
