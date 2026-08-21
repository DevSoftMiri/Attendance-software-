import bcrypt from 'bcrypt';

class MemoryRecord {
    constructor(repository, data) {
        this._repository = repository;
        Object.assign(this, data);
    }

    async update(values) {
        Object.assign(this, values, { updatedAt: new Date() });
        return this.save();
    }

    async save() {
        this.updatedAt = new Date();
        this._repository.upsert(this);
        return this;
    }

    async destroy() {
        this._repository.deleteById(this.id);
    }

    toJSON() {
        const output = {};
        for (const key of Object.keys(this)) {
            if (key !== '_repository') {
                output[key] = this[key];
            }
        }
        return output;
    }
}

class MemoryRepository {
    constructor(key, defaults = {}) {
        this.key = key;
        this.defaults = defaults;
        this.rows = [];
        this.nextId = 1;
    }

    seed(items) {
        for (const item of items) {
            this.upsert(new MemoryRecord(this, this.applyDefaults(item)));
        }
    }

    applyDefaults(values) {
        const now = new Date();
        return {
            id: values.id ?? this.nextId++,
            createdAt: values.createdAt || now,
            updatedAt: values.updatedAt || now,
            ...values
        };
    }

    upsert(record) {
        const plain = record instanceof MemoryRecord ? record : new MemoryRecord(this, record);
        const index = this.rows.findIndex((entry) => entry.id === plain.id);
        if (index >= 0) {
            this.rows[index] = plain;
        } else {
            this.rows.push(plain);
        }
        this.nextId = Math.max(this.nextId, Number(plain.id) + 1);
        return plain;
    }

    deleteById(id) {
        this.rows = this.rows.filter((entry) => entry.id !== Number(id));
    }

    matchesWhere(row, where = {}) {
        if (!where || !Object.keys(where).length) {
            return true;
        }

        if (Array.isArray(where)) {
            return where.every((entry) => this.matchesWhere(row, entry));
        }

        for (const symbol of Object.getOwnPropertySymbols(where)) {
            if (symbol.description === 'or') {
                return where[symbol].some((entry) => this.matchesWhere(row, entry));
            }
        }

        return Object.entries(where).every(([field, expected]) => this.matchesValue(row[field], expected));
    }

    matchesValue(actual, expected) {
        if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
            for (const symbol of Object.getOwnPropertySymbols(expected)) {
                if (symbol.description === 'like') {
                    const pattern = String(expected[symbol]).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
                    return new RegExp(`^${pattern}$`, 'i').test(String(actual ?? ''));
                }
                if (symbol.description === 'in') {
                    return expected[symbol].includes(actual);
                }
                if (symbol.description === 'between') {
                    return actual >= expected[symbol][0] && actual <= expected[symbol][1];
                }
                if (symbol.description === 'gte') {
                    return actual >= expected[symbol];
                }
                if (symbol.description === 'lte') {
                    return actual <= expected[symbol];
                }
                if (symbol.description === 'gt') {
                    return actual > expected[symbol];
                }
                if (symbol.description === 'lt') {
                    return actual < expected[symbol];
                }
                if (symbol.description === 'ne') {
                    return String(actual) !== String(expected[symbol]);
                }
                if (symbol.description === 'not') {
                    return String(actual) !== String(expected[symbol]);
                }
            }

            if (Object.prototype.hasOwnProperty.call(expected, 'in')) {
                return expected.in.includes(actual);
            }
        }

        return String(actual) === String(expected);
    }

    sortRows(rows, order = []) {
        if (!order.length) {
            return rows;
        }

        const [field, direction] = order[0];
        return [...rows].sort((left, right) => {
            const leftValue = left[field];
            const rightValue = right[field];
            if (leftValue === rightValue) {
                return 0;
            }
            const result = leftValue > rightValue ? 1 : -1;
            return String(direction).toUpperCase() === 'DESC' ? -result : result;
        });
    }

    async create(values) {
        const record = new MemoryRecord(this, this.applyDefaults({ ...this.defaults, ...values }));
        this.rows.push(record);
        this.nextId = Math.max(this.nextId, Number(record.id) + 1);
        return record;
    }

    async findByPk(id) {
        return this.rows.find((entry) => Number(entry.id) === Number(id)) || null;
    }

    async findOne(options = {}) {
        return (await this.findAll(options))[0] || null;
    }

    async findAll(options = {}) {
        const filtered = this.rows.filter((row) => this.matchesWhere(row, options.where));
        const ordered = this.sortRows(filtered, options.order || []);
        const limited = options.limit ? ordered.slice(0, options.limit) : ordered;
        return limited;
    }

    async bulkCreate(items = []) {
        const created = [];
        for (const item of items) {
            created.push(await this.create(item));
        }
        return created;
    }

    async destroy(options = {}) {
        const before = this.rows.length;
        this.rows = this.rows.filter((row) => !this.matchesWhere(row, options.where));
        return before - this.rows.length;
    }

    async update(values, options = {}) {
        const matches = await this.findAll({ where: options.where });
        for (const row of matches) {
            Object.assign(row, values, { updatedAt: new Date() });
        }
        return [matches.length];
    }

    async count(options = {}) {
        return (await this.findAll(options)).length;
    }

    async findOrCreate(options = {}) {
        const found = await this.findOne({ where: options.where });
        if (found) {
            return [found, false];
        }

        const created = await this.create(options.defaults || {});
        return [created, true];
    }
}

function createSeedData() {
    const passwordHash = bcrypt.hashSync('Admin@123', 10);
    return {
        Organisation: [
            {
                id: 1,
                name: 'Attendance Demo Org',
                initial: 'M',
                logoUrl: null,
                officeAddress: 'Demo Office',
                weeklyWorkingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
                payrollPeriod: 'MONTHLY',
                salaryRules: {},
                attendancePolicies: { geofenceRadius: 150 },
                settings: {}
            }
        ],
        Branch: [
            {
                id: 1,
                organisationId: 1,
                name: 'Head Office',
                code: 'HO',
                address: 'Demo Office',
                latitude: 0,
                longitude: 0,
                radiusMetres: 150,
                isActive: true
            }
        ],
        Shift: [
            {
                id: 1,
                organisationId: 1,
                name: 'General Shift',
                startTime: '09:00',
                endTime: '18:00',
                breakDurationMinutes: 60,
                requiredWorkingHours: 8,
                graceTimeMinutes: 15,
                earlyLogoutThresholdMinutes: 30,
                halfDayThresholdMinutes: 240,
                overtimeThresholdMinutes: 480,
                overnightShift: false,
                isActive: true
            }
        ],
        User: [
            {
                id: 1,
                organisationId: 1,
                employeeId: 1,
                email: 'admin@local.dev',
                passwordHash,
                status: 'ACTIVE',
                mustChangePassword: false,
                roleCode: 'SUPER_ADMIN'
            }
        ],
        Employee: [
            {
                id: 1,
                organisationId: 1,
                userId: 1,
                employeeCode: 'M-ADM-AA-140726-01',
                fullName: 'Admin Account',
                email: 'admin@local.dev',
                phone: '9999999999',
                branchId: 1,
                joiningDate: '2026-07-14',
                loginTime: '09:00',
                roleCode: 'SUPER_ADMIN',
                shiftId: 1,
                status: 'ACTIVE',
                employmentType: 'FULL_TIME',
                salaryType: 'MONTHLY',
                baseSalary: 50000,
                overtimeEligible: true,
                overtimeRate: 250,
                leaveEntitlement: 12,
                halfDayEntitlement: 6
            }
        ]
    };
}

export function createMemoryModels(definitions) {
    const models = {};

    for (const definition of definitions) {
        models[definition.key] = new MemoryRepository(definition.key);
    }

    const seedData = createSeedData();
    for (const [key, rows] of Object.entries(seedData)) {
        if (models[key]) {
            models[key].seed(rows);
        }
    }

    return models;
}
