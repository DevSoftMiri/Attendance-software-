import { DataTypes } from 'sequelize';

const definitions = [
    {
        key: 'Organisation',
        table: 'organisations',
        fields: {
            name: { type: DataTypes.STRING, allowNull: false },
            initial: { type: DataTypes.STRING(10), allowNull: false },
            logoUrl: { type: DataTypes.STRING },
            officeAddress: { type: DataTypes.TEXT },
            officeGeo: { type: DataTypes.JSONB },
            weeklyWorkingDays: { type: DataTypes.JSONB },
            payrollPeriod: { type: DataTypes.STRING },
            salaryRules: { type: DataTypes.JSONB },
            attendancePolicies: { type: DataTypes.JSONB },
            settings: { type: DataTypes.JSONB }
        }
    },
    {
        key: 'Branch',
        table: 'branches',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            name: { type: DataTypes.STRING, allowNull: false },
            code: { type: DataTypes.STRING },
            address: { type: DataTypes.TEXT },
            latitude: { type: DataTypes.FLOAT },
            longitude: { type: DataTypes.FLOAT },
            radiusMetres: { type: DataTypes.INTEGER, defaultValue: 150 },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'Department',
        table: 'departments',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            branchId: { type: DataTypes.INTEGER },
            name: { type: DataTypes.STRING, allowNull: false },
            code: { type: DataTypes.STRING }
        }
    },
    {
        key: 'Role',
        table: 'roles',
        fields: {
            code: { type: DataTypes.STRING, allowNull: false, unique: true },
            name: { type: DataTypes.STRING, allowNull: false },
            description: { type: DataTypes.TEXT },
            isSystem: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'Permission',
        table: 'permissions',
        fields: {
            code: { type: DataTypes.STRING, allowNull: false, unique: true },
            name: { type: DataTypes.STRING, allowNull: false },
            description: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'User',
        table: 'users',
        fields: {
            organisationId: { type: DataTypes.INTEGER },
            employeeId: { type: DataTypes.INTEGER },
            email: { type: DataTypes.STRING, allowNull: false, unique: true },
            passwordHash: { type: DataTypes.STRING, allowNull: false },
            status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE' },
            mustChangePassword: { type: DataTypes.BOOLEAN, defaultValue: false },
            lastPasswordChangeAt: { type: DataTypes.DATE },
            temporaryPasswordExpiresAt: { type: DataTypes.DATE }
        }
    },
    {
        key: 'UserRole',
        table: 'user_roles',
        fields: {
            userId: { type: DataTypes.INTEGER, allowNull: false },
            roleId: { type: DataTypes.INTEGER, allowNull: false }
        }
    },
    {
        key: 'JobTitle',
        table: 'job_titles',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            code: { type: DataTypes.STRING, allowNull: false },
            name: { type: DataTypes.STRING, allowNull: false },
            description: { type: DataTypes.TEXT },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'EmployeeJobTitle',
        table: 'employee_job_titles',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            jobTitleId: { type: DataTypes.INTEGER, allowNull: false },
            isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false }
        }
    },
    {
        key: 'Employee',
        table: 'employees',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            userId: { type: DataTypes.INTEGER },
            employeeCode: { type: DataTypes.STRING, allowNull: false, unique: true },
            fullName: { type: DataTypes.STRING, allowNull: false },
            email: { type: DataTypes.STRING, allowNull: false },
            phone: { type: DataTypes.STRING },
            profilePictureUrl: { type: DataTypes.STRING },
            departmentId: { type: DataTypes.INTEGER },
            branchId: { type: DataTypes.INTEGER },
            officeLocationId: { type: DataTypes.INTEGER },
            joiningDate: { type: DataTypes.DATEONLY },
            loginTime: { type: DataTypes.STRING },
            reportingManagerId: { type: DataTypes.INTEGER },
            roleCode: { type: DataTypes.STRING },
            shiftId: { type: DataTypes.INTEGER },
            status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' },
            employmentType: { type: DataTypes.STRING },
            salaryType: { type: DataTypes.STRING },
            baseSalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            overtimeEligible: { type: DataTypes.BOOLEAN, defaultValue: false },
            overtimeRate: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            leaveEntitlement: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            unpaidLeaveEntitlement: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            halfDayEntitlement: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            probationEndsOn: { type: DataTypes.DATEONLY },
            confirmationDate: { type: DataTypes.DATEONLY },
            resignationDate: { type: DataTypes.DATEONLY },
            exitDate: { type: DataTypes.DATEONLY }
        }
    },
    {
        key: 'EmployeeManager',
        table: 'employee_managers',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            managerEmployeeId: { type: DataTypes.INTEGER, allowNull: false },
            activeFrom: { type: DataTypes.DATEONLY },
            activeTo: { type: DataTypes.DATEONLY }
        }
    },
    {
        key: 'EmployeeLifecycleEvent',
        table: 'employee_lifecycle_events',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            eventType: { type: DataTypes.STRING, allowNull: false },
            eventDate: { type: DataTypes.DATEONLY, allowNull: false },
            notes: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'EmployeeDocument',
        table: 'employee_documents',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            documentType: { type: DataTypes.STRING, allowNull: false },
            fileUrl: { type: DataTypes.STRING, allowNull: false },
            visibility: { type: DataTypes.STRING, defaultValue: 'PRIVATE' },
            uploadedByUserId: { type: DataTypes.INTEGER }
        }
    },
    {
        key: 'EmployeeAsset',
        table: 'employee_assets',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            assetName: { type: DataTypes.STRING, allowNull: false },
            assetCode: { type: DataTypes.STRING },
            serialNumber: { type: DataTypes.STRING },
            assignmentDate: { type: DataTypes.DATEONLY },
            returnDate: { type: DataTypes.DATEONLY },
            status: { type: DataTypes.STRING, defaultValue: 'ASSIGNED' },
            conditionAtAssignment: { type: DataTypes.STRING },
            conditionAtReturn: { type: DataTypes.STRING },
            notes: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'Shift',
        table: 'shifts',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            name: { type: DataTypes.STRING, allowNull: false },
            startTime: { type: DataTypes.STRING, allowNull: false },
            endTime: { type: DataTypes.STRING, allowNull: false },
            breakDurationMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            requiredWorkingHours: { type: DataTypes.INTEGER, defaultValue: 8 },
            graceTimeMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            earlyLogoutThresholdMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            halfDayThresholdMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            overtimeThresholdMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            overnightShift: { type: DataTypes.BOOLEAN, defaultValue: false },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'ShiftAssignment',
        table: 'shift_assignments',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            shiftId: { type: DataTypes.INTEGER, allowNull: false },
            startsOn: { type: DataTypes.DATEONLY },
            endsOn: { type: DataTypes.DATEONLY },
            assignmentType: { type: DataTypes.STRING, defaultValue: 'PERMANENT' },
            reason: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'Holiday',
        table: 'holidays',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            branchId: { type: DataTypes.INTEGER },
            name: { type: DataTypes.STRING, allowNull: false },
            holidayDate: { type: DataTypes.DATEONLY, allowNull: false },
            type: { type: DataTypes.STRING, defaultValue: 'COMPANY' },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'OfficeLocation',
        table: 'office_locations',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            branchId: { type: DataTypes.INTEGER },
            name: { type: DataTypes.STRING, allowNull: false },
            latitude: { type: DataTypes.FLOAT, allowNull: false },
            longitude: { type: DataTypes.FLOAT, allowNull: false },
            radiusMetres: { type: DataTypes.INTEGER, defaultValue: 150 },
            isPrimary: { type: DataTypes.BOOLEAN, defaultValue: false }
        }
    },
    {
        key: 'ApprovedIpAddress',
        table: 'approved_ip_addresses',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            branchId: { type: DataTypes.INTEGER },
            ipAddress: { type: DataTypes.STRING, allowNull: false },
            description: { type: DataTypes.STRING },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'AttendanceEvent',
        table: 'attendance_events',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            eventType: { type: DataTypes.STRING, allowNull: false },
            serverTimestamp: { type: DataTypes.DATE, allowNull: false },
            deviceTimestamp: { type: DataTypes.DATE },
            latitude: { type: DataTypes.FLOAT },
            longitude: { type: DataTypes.FLOAT },
            locationAccuracy: { type: DataTypes.FLOAT },
            distanceFromOffice: { type: DataTypes.FLOAT },
            publicIp: { type: DataTypes.STRING },
            officeIpVerified: { type: DataTypes.BOOLEAN },
            faceVerified: { type: DataTypes.BOOLEAN },
            antiSpoofingPassed: { type: DataTypes.BOOLEAN },
            faceDistance: { type: DataTypes.FLOAT },
            faceThreshold: { type: DataTypes.FLOAT },
            deviceInformation: { type: DataTypes.JSONB },
            browserInformation: { type: DataTypes.JSONB },
            validationStatus: { type: DataTypes.STRING },
            failureReason: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'AttendanceSummary',
        table: 'attendance_summaries',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            attendanceDate: { type: DataTypes.DATEONLY, allowNull: false },
            shiftId: { type: DataTypes.INTEGER },
            firstCheckIn: { type: DataTypes.DATE },
            lastCheckOut: { type: DataTypes.DATE },
            totalWorkingMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            breakMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            lateMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            earlyLogoutMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            overtimeMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
            attendanceStatus: { type: DataTypes.STRING, defaultValue: 'PRESENT' },
            regularized: { type: DataTypes.BOOLEAN, defaultValue: false },
            payrollProcessed: { type: DataTypes.BOOLEAN, defaultValue: false }
        }
    },
    {
        key: 'AttendanceRegularizationRequest',
        table: 'attendance_regularization_requests',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            attendanceEventId: { type: DataTypes.INTEGER },
            attendanceDate: { type: DataTypes.DATEONLY, allowNull: false },
            requestedCheckIn: { type: DataTypes.DATE },
            requestedCheckOut: { type: DataTypes.DATE },
            reason: { type: DataTypes.TEXT, allowNull: false },
            attachmentUrl: { type: DataTypes.STRING },
            status: { type: DataTypes.STRING, defaultValue: 'PENDING' },
            approverUserId: { type: DataTypes.INTEGER },
            approverComment: { type: DataTypes.TEXT },
            originalPayload: { type: DataTypes.JSONB },
            requestedPayload: { type: DataTypes.JSONB }
        }
    },
    {
        key: 'FaceProfile',
        table: 'face_profiles',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
            referenceImageUrls: { type: DataTypes.JSONB },
            embeddingReferences: { type: DataTypes.JSONB },
            qualityScore: { type: DataTypes.FLOAT },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'FaceVerificationLog',
        table: 'face_verification_logs',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            attendanceEventId: { type: DataTypes.INTEGER },
            matched: { type: DataTypes.BOOLEAN },
            confidence: { type: DataTypes.FLOAT },
            distance: { type: DataTypes.FLOAT },
            threshold: { type: DataTypes.FLOAT },
            antiSpoofingPassed: { type: DataTypes.BOOLEAN },
            responsePayload: { type: DataTypes.JSONB }
        }
    },
    {
        key: 'LeaveType',
        table: 'leave_types',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            code: { type: DataTypes.STRING, allowNull: false },
            name: { type: DataTypes.STRING, allowNull: false },
            paid: { type: DataTypes.BOOLEAN, defaultValue: true },
            allowHalfDay: { type: DataTypes.BOOLEAN, defaultValue: true },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'LeavePolicy',
        table: 'leave_policies',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            leaveTypeId: { type: DataTypes.INTEGER, allowNull: false },
            annualAllowance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            monthlyAllowance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            carryForward: { type: DataTypes.BOOLEAN, defaultValue: false },
            requiresProof: { type: DataTypes.BOOLEAN, defaultValue: false },
            minNoticeDays: { type: DataTypes.INTEGER, defaultValue: 0 }
        }
    },
    {
        key: 'LeaveBalance',
        table: 'leave_balances',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            leaveTypeId: { type: DataTypes.INTEGER, allowNull: false },
            openingBalance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            currentBalance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            year: { type: DataTypes.INTEGER, allowNull: false }
        }
    },
    {
        key: 'LeaveTransaction',
        table: 'leave_transactions',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            leaveTypeId: { type: DataTypes.INTEGER, allowNull: false },
            transactionType: { type: DataTypes.STRING, allowNull: false },
            quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
            referenceId: { type: DataTypes.INTEGER },
            notes: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'LeaveRequest',
        table: 'leave_requests',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            leaveTypeId: { type: DataTypes.INTEGER, allowNull: false },
            startDate: { type: DataTypes.DATEONLY, allowNull: false },
            endDate: { type: DataTypes.DATEONLY, allowNull: false },
            leaveMode: { type: DataTypes.STRING, defaultValue: 'FULL_DAY' },
            reason: { type: DataTypes.TEXT },
            proofUrl: { type: DataTypes.STRING },
            reportingManagerId: { type: DataTypes.INTEGER },
            status: { type: DataTypes.STRING, defaultValue: 'PENDING' },
            approverUserId: { type: DataTypes.INTEGER },
            approverComment: { type: DataTypes.TEXT },
            submittedAt: { type: DataTypes.DATE },
            decidedAt: { type: DataTypes.DATE }
        }
    },
    {
        key: 'SalaryStructure',
        table: 'salary_structures',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            salaryType: { type: DataTypes.STRING, allowNull: false },
            baseSalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            overtimeRate: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            monthlyWorkingDays: { type: DataTypes.INTEGER, defaultValue: 30 },
            pfRate: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            esiRate: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            taxRules: { type: DataTypes.JSONB },
            effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
            effectiveTo: { type: DataTypes.DATEONLY },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
            monthlySalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            basicSalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            hra: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            allowances: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            standardWorkingHoursPerDay: { type: DataTypes.INTEGER, defaultValue: 8 },
            standardWorkingDays: { type: DataTypes.INTEGER, defaultValue: 26 },
            overtimeEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
            overtimeRatePerHour: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            overtimeRatePerDay: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            paidLeavesAllowed: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            halfDayAllowance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            defaultBonus: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            shortHoursDeductionEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
            unpaidLeaveDeductionEnabled: { type: DataTypes.BOOLEAN, defaultValue: true }
        }
    },
    {
        key: 'SalaryComponent',
        table: 'salary_components',
        fields: {
            salaryStructureId: { type: DataTypes.INTEGER, allowNull: false },
            componentType: { type: DataTypes.STRING, allowNull: false },
            name: { type: DataTypes.STRING, allowNull: false },
            amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            isDeduction: { type: DataTypes.BOOLEAN, defaultValue: false }
        }
    },
    {
        key: 'Incentive',
        table: 'incentives',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            incentiveType: { type: DataTypes.STRING, allowNull: false },
            reference: { type: DataTypes.STRING },
            amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            month: { type: DataTypes.STRING },
            status: { type: DataTypes.STRING, defaultValue: 'PENDING' },
            createdByUserId: { type: DataTypes.INTEGER },
            approvedByUserId: { type: DataTypes.INTEGER }
        }
    },
    {
        key: 'SalaryAdvance',
        table: 'salary_advances',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            remainingAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            issuedAt: { type: DataTypes.DATE },
            recoveredAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }
        }
    },
    {
        key: 'EmployeeLoan',
        table: 'employee_loans',
        fields: {
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            remainingAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            interestRate: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            issuedAt: { type: DataTypes.DATE },
            status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' }
        }
    },
    {
        key: 'PayrollPeriod',
        table: 'payroll_periods',
        fields: {
            organisationId: { type: DataTypes.INTEGER, allowNull: false },
            month: { type: DataTypes.INTEGER, allowNull: false },
            year: { type: DataTypes.INTEGER, allowNull: false },
            startDate: { type: DataTypes.DATEONLY, allowNull: false },
            endDate: { type: DataTypes.DATEONLY, allowNull: false },
            payDate: { type: DataTypes.DATEONLY },
            status: { type: DataTypes.STRING, defaultValue: 'DRAFT' }
        }
    },
    {
        key: 'PayrollRun',
        table: 'payroll_runs',
        fields: {
            payrollPeriodId: { type: DataTypes.INTEGER, allowNull: false },
            status: { type: DataTypes.STRING, defaultValue: 'DRAFT' },
            lockedAt: { type: DataTypes.DATE },
            lockedByUserId: { type: DataTypes.INTEGER },
            unlockReason: { type: DataTypes.TEXT },
            approvedAt: { type: DataTypes.DATE },
            approvedByUserId: { type: DataTypes.INTEGER },
            departmentId: { type: DataTypes.INTEGER },
            employeeId: { type: DataTypes.INTEGER },
            generatedByUserId: { type: DataTypes.INTEGER },
            finalizedAt: { type: DataTypes.DATE },
            finalizedByUserId: { type: DataTypes.INTEGER },
            reopenedAt: { type: DataTypes.DATE },
            reopenedByUserId: { type: DataTypes.INTEGER },
            notes: { type: DataTypes.JSONB }
        }
    },
    {
        key: 'EmployeePayroll',
        table: 'employee_payrolls',
        fields: {
            payrollRunId: { type: DataTypes.INTEGER, allowNull: false },
            employeeId: { type: DataTypes.INTEGER, allowNull: false },
            month: { type: DataTypes.INTEGER },
            year: { type: DataTypes.INTEGER },
            status: { type: DataTypes.STRING, defaultValue: 'DRAFT' },
            salaryStructureSnapshot: { type: DataTypes.JSONB },
            payrollSettingsSnapshot: { type: DataTypes.JSONB },
            attendanceSummarySnapshot: { type: DataTypes.JSONB },
            leaveSummarySnapshot: { type: DataTypes.JSONB },
            manualAdjustments: { type: DataTypes.JSONB },
            componentOverrides: { type: DataTypes.JSONB },
            payrollInputs: { type: DataTypes.JSONB },
            grossEarnings: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            grossSalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            totalDeductions: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            netSalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
            paymentStatus: { type: DataTypes.STRING, defaultValue: 'PENDING' },
            paymentDate: { type: DataTypes.DATE },
            generatedAt: { type: DataTypes.DATE },
            generatedByUserId: { type: DataTypes.INTEGER },
            finalizedAt: { type: DataTypes.DATE },
            finalizedByUserId: { type: DataTypes.INTEGER },
            paidAt: { type: DataTypes.DATE },
            paidByUserId: { type: DataTypes.INTEGER },
            lastCalculatedAt: { type: DataTypes.DATE },
            notes: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'PayrollEarning',
        table: 'payroll_earnings',
        fields: {
            employeePayrollId: { type: DataTypes.INTEGER, allowNull: false },
            componentCode: { type: DataTypes.STRING },
            name: { type: DataTypes.STRING, allowNull: false },
            amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }
        }
    },
    {
        key: 'PayrollDeduction',
        table: 'payroll_deductions',
        fields: {
            employeePayrollId: { type: DataTypes.INTEGER, allowNull: false },
            componentCode: { type: DataTypes.STRING },
            name: { type: DataTypes.STRING, allowNull: false },
            amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }
        }
    },
    {
        key: 'SalarySlip',
        table: 'salary_slips',
        fields: {
            employeePayrollId: { type: DataTypes.INTEGER, allowNull: false },
            fileUrl: { type: DataTypes.STRING },
            generatedAt: { type: DataTypes.DATE },
            status: { type: DataTypes.STRING, defaultValue: 'GENERATED' },
            payload: { type: DataTypes.JSONB }
        }
    },
    {
        key: 'PaymentRecord',
        table: 'payment_records',
        fields: {
            employeePayrollId: { type: DataTypes.INTEGER, allowNull: false },
            amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
            method: { type: DataTypes.STRING },
            reference: { type: DataTypes.STRING },
            notes: { type: DataTypes.TEXT },
            createdByUserId: { type: DataTypes.INTEGER },
            paidAt: { type: DataTypes.DATE }
        }
    },
    {
        key: 'Notification',
        table: 'notifications',
        fields: {
            userId: { type: DataTypes.INTEGER, allowNull: false },
            type: { type: DataTypes.STRING, allowNull: false },
            title: { type: DataTypes.STRING, allowNull: false },
            body: { type: DataTypes.TEXT, allowNull: false },
            payload: { type: DataTypes.JSONB },
            readAt: { type: DataTypes.DATE }
        }
    },
    {
        key: 'EmailLog',
        table: 'email_logs',
        fields: {
            toEmail: { type: DataTypes.STRING, allowNull: false },
            subject: { type: DataTypes.STRING, allowNull: false },
            status: { type: DataTypes.STRING, allowNull: false },
            errorMessage: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'LoginHistory',
        table: 'login_history',
        fields: {
            userId: { type: DataTypes.INTEGER },
            actionType: { type: DataTypes.STRING, allowNull: false },
            ipAddress: { type: DataTypes.STRING },
            deviceInformation: { type: DataTypes.JSONB },
            browserInformation: { type: DataTypes.JSONB },
            occurredAt: { type: DataTypes.DATE, allowNull: false },
            success: { type: DataTypes.BOOLEAN, defaultValue: true },
            reason: { type: DataTypes.TEXT }
        }
    },
    {
        key: 'AuditLog',
        table: 'audit_logs',
        fields: {
            userId: { type: DataTypes.INTEGER },
            actionType: { type: DataTypes.STRING, allowNull: false },
            entityName: { type: DataTypes.STRING },
            entityId: { type: DataTypes.STRING },
            oldValue: { type: DataTypes.JSONB },
            newValue: { type: DataTypes.JSONB },
            reason: { type: DataTypes.TEXT },
            ipAddress: { type: DataTypes.STRING },
            deviceInformation: { type: DataTypes.JSONB },
            browserInformation: { type: DataTypes.JSONB }
        }
    }
];

export function initModels(sequelize) {
    const models = {};
    const modelOptionsByKey = {
        PayrollPeriod: {
            indexes: [
                { unique: true, fields: ['organisation_id', 'month', 'year'] }
            ]
        },
        EmployeePayroll: {
            indexes: [
                { unique: true, fields: ['payroll_run_id', 'employee_id'] }
            ]
        }
    };

    for (const definition of definitions) {
        models[definition.key] = sequelize.define(definition.table, definition.fields, {
            tableName: definition.table,
            underscored: true,
            ...(modelOptionsByKey[definition.key] || {})
        });
    }

    if (models.User && models.Employee) {
        models.User.belongsTo(models.Employee, { foreignKey: 'employeeId' });
        models.Employee.hasOne(models.User, { foreignKey: 'employeeId' });
    }

    if (models.Employee && models.AttendanceEvent) {
        models.Employee.hasMany(models.AttendanceEvent, { foreignKey: 'employeeId' });
        models.AttendanceEvent.belongsTo(models.Employee, { foreignKey: 'employeeId' });
    }

    if (models.Employee && models.LeaveRequest) {
        models.Employee.hasMany(models.LeaveRequest, { foreignKey: 'employeeId' });
        models.LeaveRequest.belongsTo(models.Employee, { foreignKey: 'employeeId' });
    }

    if (models.Employee && models.FaceProfile) {
        models.Employee.hasOne(models.FaceProfile, { foreignKey: 'employeeId' });
        models.FaceProfile.belongsTo(models.Employee, { foreignKey: 'employeeId' });
    }

    if (models.PayrollRun && models.EmployeePayroll) {
        models.PayrollRun.hasMany(models.EmployeePayroll, { foreignKey: 'payrollRunId' });
        models.EmployeePayroll.belongsTo(models.PayrollRun, { foreignKey: 'payrollRunId' });
    }

    if (models.PayrollPeriod && models.PayrollRun) {
        models.PayrollPeriod.hasMany(models.PayrollRun, { foreignKey: 'payrollPeriodId' });
        models.PayrollRun.belongsTo(models.PayrollPeriod, { foreignKey: 'payrollPeriodId' });
    }

    if (models.Employee && models.EmployeePayroll) {
        models.Employee.hasMany(models.EmployeePayroll, { foreignKey: 'employeeId' });
        models.EmployeePayroll.belongsTo(models.Employee, { foreignKey: 'employeeId' });
    }

    if (models.EmployeePayroll && models.PayrollEarning) {
        models.EmployeePayroll.hasMany(models.PayrollEarning, { foreignKey: 'employeePayrollId' });
        models.PayrollEarning.belongsTo(models.EmployeePayroll, { foreignKey: 'employeePayrollId' });
    }

    if (models.EmployeePayroll && models.PayrollDeduction) {
        models.EmployeePayroll.hasMany(models.PayrollDeduction, { foreignKey: 'employeePayrollId' });
        models.PayrollDeduction.belongsTo(models.EmployeePayroll, { foreignKey: 'employeePayrollId' });
    }

    if (models.Employee && models.SalaryStructure) {
        models.Employee.hasMany(models.SalaryStructure, { foreignKey: 'employeeId' });
        models.SalaryStructure.belongsTo(models.Employee, { foreignKey: 'employeeId' });
    }

    if (models.EmployeePayroll && models.SalarySlip) {
        models.EmployeePayroll.hasOne(models.SalarySlip, { foreignKey: 'employeePayrollId' });
        models.SalarySlip.belongsTo(models.EmployeePayroll, { foreignKey: 'employeePayrollId' });
    }

    if (models.EmployeePayroll && models.PaymentRecord) {
        models.EmployeePayroll.hasMany(models.PaymentRecord, { foreignKey: 'employeePayrollId' });
        models.PaymentRecord.belongsTo(models.EmployeePayroll, { foreignKey: 'employeePayrollId' });
    }

    return models;
}

export { definitions as modelDefinitions };
