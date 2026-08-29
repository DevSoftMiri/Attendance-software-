import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateEmployeeId } from '../utils/employeeId.js';
import { models } from '../models/store.js';

function getTitleCode(title) {
    return String(title || 'EMP')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 3)
        .toUpperCase() || 'EMP';
}

function parseNullableInteger(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === '' || value === null) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseNullableNumber(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === '' || value === null) {
        return null;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function normalizePhone(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === '' || value === null) {
        return null;
    }

    return String(value).replace(/\D/g, '');
}

function assertValidPhone(phone) {
    if (phone === undefined || phone === null) {
        return;
    }

    if (!/^\d{10}$/.test(phone)) {
        const error = new Error('Phone number must be exactly 10 digits');
        error.statusCode = 400;
        throw error;
    }
}

function buildEmployeeCreatePayload(body) {
    const normalizedPhone = normalizePhone(body.phone);
    assertValidPhone(normalizedPhone);

    return {
        organisationId: parseNullableInteger(body.organisationId),
        fullName: body.fullName,
        email: body.email,
        phone: normalizedPhone,
        joiningDate: body.joiningDate || null,
        loginTime: body.loginTime || null,
        roleCode: body.roleCode || 'STAFF',
        departmentId: parseNullableInteger(body.departmentId),
        branchId: parseNullableInteger(body.branchId),
        reportingManagerId: parseNullableInteger(body.reportingManagerId),
        shiftId: parseNullableInteger(body.shiftId),
        employmentType: body.employmentType || 'FULL_TIME',
        salaryType: body.salaryType || 'MONTHLY',
        baseSalary: parseNullableNumber(body.baseSalary) ?? 0,
        leaveEntitlement: parseNullableNumber(body.leaveEntitlement) ?? 0,
        unpaidLeaveEntitlement: parseNullableNumber(body.unpaidLeaveEntitlement) ?? 0
    };
}

function buildEmployeeUpdatePayload(body) {
    const payload = {};

    if (body.organisationId !== undefined) {
        payload.organisationId = parseNullableInteger(body.organisationId);
    }

    if (body.fullName !== undefined) {
        payload.fullName = body.fullName;
    }

    if (body.email !== undefined) {
        payload.email = body.email;
    }

    if (body.phone !== undefined) {
        payload.phone = normalizePhone(body.phone);
        assertValidPhone(payload.phone);
    }

    if (body.joiningDate !== undefined) {
        payload.joiningDate = body.joiningDate || null;
    }

    if (body.loginTime !== undefined) {
        payload.loginTime = body.loginTime || null;
    }

    if (body.roleCode !== undefined) {
        payload.roleCode = body.roleCode || null;
    }

    if (body.departmentId !== undefined) {
        payload.departmentId = parseNullableInteger(body.departmentId);
    }

    if (body.branchId !== undefined) {
        payload.branchId = parseNullableInteger(body.branchId);
    }

    if (body.reportingManagerId !== undefined) {
        payload.reportingManagerId = parseNullableInteger(body.reportingManagerId);
    }

    if (body.shiftId !== undefined) {
        payload.shiftId = parseNullableInteger(body.shiftId);
    }

    if (body.employmentType !== undefined) {
        payload.employmentType = body.employmentType || null;
    }

    if (body.salaryType !== undefined) {
        payload.salaryType = body.salaryType || null;
    }

    if (body.baseSalary !== undefined) {
        payload.baseSalary = parseNullableNumber(body.baseSalary);
    }

    if (body.leaveEntitlement !== undefined) {
        payload.leaveEntitlement = parseNullableNumber(body.leaveEntitlement);
    }

    if (body.unpaidLeaveEntitlement !== undefined) {
        payload.unpaidLeaveEntitlement = parseNullableNumber(body.unpaidLeaveEntitlement);
    }

    return payload;
}

async function syncEmployeeUser(employee, body) {
    const user = employee.userId
        ? await models.User.findByPk(employee.userId)
        : await models.User.findOne({ where: { employeeId: employee.id } });

    if (!user) {
        return null;
    }

    const userUpdates = {};
    if (body.email !== undefined) {
        userUpdates.email = body.email;
    }

    if (body.password) {
        userUpdates.passwordHash = await bcrypt.hash(body.password, 12);
        userUpdates.mustChangePassword = true;
        userUpdates.lastPasswordChangeAt = new Date();
        userUpdates.temporaryPasswordExpiresAt = null;
    }

    if (Object.keys(userUpdates).length) {
        await user.update(userUpdates);
    }

    return user;
}

export const listEmployees = asyncHandler(async (request, response) => {
    const employees = await models.Employee.findAll({ order: [['createdAt', 'DESC']] });
    return response.json({ employees });
});

export const getEmployee = asyncHandler(async (request, response) => {
    const employee = await models.Employee.findByPk(request.params.id);
    if (!employee) {
        return response.status(404).json({ message: 'Employee not found' });
    }

    return response.json({ employee });
});

export const createEmployee = asyncHandler(async (request, response) => {
    const {
        organisationId,
        organisationInitial = 'ORG',
        fullName,
        email,
        phone,
        joiningDate,
        loginTime,
        roleCode = 'STAFF',
        jobTitleCode = 'EMP',
        baseSalary = 0,
        salaryType = 'MONTHLY',
        password,
        departmentId = null,
        branchId = null,
        reportingManagerId = null,
        shiftId = null,
        employmentType = 'FULL_TIME',
        leaveEntitlement = 0,
        unpaidLeaveEntitlement = 0
    } = request.body;

    const baseEmployeeCode = generateEmployeeId({
        organisationInitial,
        titleCode: getTitleCode(jobTitleCode || roleCode),
        employeeName: fullName,
        joiningDate,
        phoneNumber: phone,
        duplicateIndex: 0
    });

    const duplicateCount = await models.Employee.count({
        where: {
            organisationId,
            employeeCode: {
                [Op.like]: `${baseEmployeeCode}%`
            }
        }
    });

    const employeeCode = duplicateCount > 0
        ? generateEmployeeId({
            organisationInitial,
            titleCode: getTitleCode(jobTitleCode || roleCode),
            employeeName: fullName,
            joiningDate,
            phoneNumber: phone,
            duplicateIndex: duplicateCount
        })
        : baseEmployeeCode;

    const employee = await models.Employee.create({
        ...buildEmployeeCreatePayload({
            organisationId,
            fullName,
            email,
            phone,
            joiningDate,
            loginTime,
            roleCode,
            departmentId,
            branchId,
            reportingManagerId,
            shiftId,
            employmentType,
            salaryType,
            baseSalary,
            leaveEntitlement,
            unpaidLeaveEntitlement
        }),
        employeeCode
    });

    const passwordHash = password ? await bcrypt.hash(password, 12) : await bcrypt.hash('ChangeMe@123', 12);
    const user = await models.User.create({
        organisationId,
        employeeId: employee.id,
        email,
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: true
    });

    employee.userId = user.id;
    await employee.save();

    return response.status(201).json({ employee, user });
});

export const updateEmployee = asyncHandler(async (request, response) => {
    const employee = await models.Employee.findByPk(request.params.id);
    if (!employee) {
        return response.status(404).json({ message: 'Employee not found' });
    }

    const updates = buildEmployeeUpdatePayload(request.body);
    await employee.update(updates);
    const user = await syncEmployeeUser(employee, request.body);

    return response.json({ employee, user });
});

export const deleteEmployee = asyncHandler(async (request, response) => {
    const employee = await models.Employee.findByPk(request.params.id);
    if (!employee) {
        return response.status(404).json({ message: 'Employee not found' });
    }

    const user = employee.userId
        ? await models.User.findByPk(employee.userId)
        : await models.User.findOne({ where: { employeeId: employee.id } });

    if (user) {
        await user.destroy();
    }

    await employee.destroy();

    return response.json({ message: 'Employee deleted successfully' });
});
