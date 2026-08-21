import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { connectDatabase, sequelize } from '../config/db.js';
import { initModels } from '../models/index.js';

dotenv.config();

const SUPER_ADMIN_EMAIL = 'jatin@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Bigubuisness';
const ORGANISATION_ID = 1;

function buildEmployeeCode() {
    return `SUPADMIN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
}

async function seedSuperAdmin() {
    const models = initModels(sequelize);
    await connectDatabase();

    const transaction = await sequelize.transaction();

    try {
        let user = await models.User.findOne({
            where: { email: SUPER_ADMIN_EMAIL },
            include: [{ model: models.Employee }],
            transaction
        });

        const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

        if (user) {
            if (!user.employeeId && !user.Employee) {
                const employee = await models.Employee.create(
                    {
                        organisationId: ORGANISATION_ID,
                        employeeCode: buildEmployeeCode(),
                        fullName: 'Jatin',
                        email: SUPER_ADMIN_EMAIL,
                        roleCode: 'SUPER_ADMIN',
                        status: 'ACTIVE',
                        employmentType: 'FULL_TIME',
                        salaryType: 'MONTHLY',
                        baseSalary: 0
                    },
                    { transaction }
                );

                await user.update(
                    {
                        employeeId: employee.id
                    },
                    { transaction }
                );
            } else {
                const employee = user.Employee || await models.Employee.findByPk(user.employeeId, { transaction });
                if (employee) {
                    await employee.update(
                        {
                            fullName: employee.fullName || 'Jatin',
                            email: SUPER_ADMIN_EMAIL,
                            roleCode: 'SUPER_ADMIN',
                            status: 'ACTIVE'
                        },
                        { transaction }
                    );
                }
            }

            await user.update(
                {
                    email: SUPER_ADMIN_EMAIL,
                    passwordHash,
                    status: 'ACTIVE',
                    mustChangePassword: false
                },
                { transaction }
            );

            await transaction.commit();
            console.log(`Updated super admin: ${SUPER_ADMIN_EMAIL}`);
            return;
        }

        const employee = await models.Employee.create(
            {
                organisationId: ORGANISATION_ID,
                employeeCode: buildEmployeeCode(),
                fullName: 'Jatin',
                email: SUPER_ADMIN_EMAIL,
                roleCode: 'SUPER_ADMIN',
                status: 'ACTIVE',
                employmentType: 'FULL_TIME',
                salaryType: 'MONTHLY',
                baseSalary: 0
            },
            { transaction }
        );

        user = await models.User.create(
            {
                organisationId: ORGANISATION_ID,
                employeeId: employee.id,
                email: SUPER_ADMIN_EMAIL,
                passwordHash,
                status: 'ACTIVE',
                mustChangePassword: false
            },
            { transaction }
        );

        await employee.update({ userId: user.id }, { transaction });

        await transaction.commit();
        console.log(`Created super admin: ${SUPER_ADMIN_EMAIL}`);
    } catch (error) {
        await transaction.rollback();
        throw error;
    } finally {
        await sequelize.close();
    }
}

seedSuperAdmin().catch((error) => {
    console.error('Failed to seed super admin', error);
    process.exit(1);
});
