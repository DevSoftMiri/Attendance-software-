import { Router } from 'express';
import { authenticateRequest, requireRole } from '../middleware/auth.js';
import {
    finalizePayrollRecord,
    generateEmployeePayroll,
    generatePayrollBatch,
    getMyPayrollRecord,
    getPayrollPayslip,
    getPayrollRecord,
    listMyPayroll,
    listPayrollPaymentRecords,
    listPayrollRecords,
    markPayrollRecordPaid,
    previewEmployeePayroll,
    reopenPayrollRecord,
    updatePayrollRecord
} from '../controllers/payrollController.js';

const router = Router();

router.use(authenticateRequest);
router.get('/my', listMyPayroll);
router.get('/my/:id', getMyPayrollRecord);
router.get('/preview/:employeeId', requireRole('SUPER_ADMIN', 'ADMIN'), previewEmployeePayroll);
router.post('/generate', requireRole('SUPER_ADMIN', 'ADMIN'), generateEmployeePayroll);
router.post('/generate-all', requireRole('SUPER_ADMIN', 'ADMIN'), generatePayrollBatch);
router.get('/payments', requireRole('SUPER_ADMIN', 'ADMIN'), listPayrollPaymentRecords);
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN'), listPayrollRecords);
router.get('/:id/payslip', getPayrollPayslip);
router.get('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), getPayrollRecord);
router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updatePayrollRecord);
router.post('/:id/finalize', requireRole('SUPER_ADMIN', 'ADMIN'), finalizePayrollRecord);
router.post('/:id/reopen', requireRole('SUPER_ADMIN', 'ADMIN'), reopenPayrollRecord);
router.post('/:id/mark-paid', requireRole('SUPER_ADMIN', 'ADMIN'), markPayrollRecordPaid);

export default router;
