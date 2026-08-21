import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, sequelize } from './config/db.js';
import { initModels, modelDefinitions } from './models/index.js';
import { createMemoryModels } from './models/memory.js';
import { setModels } from './models/store.js';

async function repairPayrollIntegrity() {
    const cleanupStatements = [
        `DELETE FROM salary_slips
         WHERE employee_payroll_id IN (
             SELECT ep.id
             FROM employee_payrolls ep
             LEFT JOIN payroll_runs pr ON pr.id = ep.payroll_run_id
             WHERE pr.id IS NULL
         )`,
        `DELETE FROM payroll_earnings
         WHERE employee_payroll_id IN (
             SELECT ep.id
             FROM employee_payrolls ep
             LEFT JOIN payroll_runs pr ON pr.id = ep.payroll_run_id
             WHERE pr.id IS NULL
         )`,
        `DELETE FROM payroll_deductions
         WHERE employee_payroll_id IN (
             SELECT ep.id
             FROM employee_payrolls ep
             LEFT JOIN payroll_runs pr ON pr.id = ep.payroll_run_id
             WHERE pr.id IS NULL
         )`,
        `DELETE FROM payment_records
         WHERE employee_payroll_id IN (
             SELECT ep.id
             FROM employee_payrolls ep
             LEFT JOIN payroll_runs pr ON pr.id = ep.payroll_run_id
             WHERE pr.id IS NULL
         )`,
        `DELETE FROM employee_payrolls
         WHERE payroll_run_id IN (
             SELECT pr.id
             FROM payroll_runs pr
             LEFT JOIN payroll_periods pp ON pp.id = pr.payroll_period_id
             WHERE pp.id IS NULL
         )`,
        `DELETE FROM payroll_runs
         WHERE payroll_period_id IN (
             SELECT pr.payroll_period_id
             FROM payroll_runs pr
             LEFT JOIN payroll_periods pp ON pp.id = pr.payroll_period_id
             WHERE pp.id IS NULL
         )`
    ];

    for (const statement of cleanupStatements) {
        await sequelize.query(statement);
    }
}

async function bootstrap() {
    let models;

    try {
        models = initModels(sequelize);
        await connectDatabase();
        if (process.env.NODE_ENV !== 'production') {
            await repairPayrollIntegrity();
            await sequelize.sync({ alter: true });
        }
        console.log('Database connection established');
    } catch (error) {
        console.warn('Database unavailable, starting in demo mode:', error.message);
        models = createMemoryModels(modelDefinitions);
    }

    setModels(models);

    const app = createApp();
    app.listen(config.port, () => {
        console.log(`Attendance backend running on port ${config.port}`);
    });
}

bootstrap().catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
});
