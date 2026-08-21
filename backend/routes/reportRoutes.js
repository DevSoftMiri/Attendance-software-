import { Router } from 'express';
import { authenticateRequest, requireRole } from '../middleware/auth.js';
import { attendanceReport, attendanceSummaryReport, lateArrivalReport, leaveReport, payrollReport } from '../controllers/reportController.js';

const router = Router();

router.use(authenticateRequest);
router.get('/attendance', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), attendanceReport);
router.get('/attendance-summary', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), attendanceSummaryReport);
router.get('/late-arrivals', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), lateArrivalReport);
router.get('/leave', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), leaveReport);
router.get('/payroll', requireRole('SUPER_ADMIN', 'ADMIN'), payrollReport);

export default router;
