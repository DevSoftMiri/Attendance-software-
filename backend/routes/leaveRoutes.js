import { Router } from 'express';
import { authenticateRequest, requireRole } from '../middleware/auth.js';
import {
    assignEmployeeLeaveBalances,
    createLeaveRequest,
    decideLeaveRequest,
    listEmployeeLeaveBalances,
    listLeaveRequests,
    listLeaveTypes
} from '../controllers/leaveController.js';

const router = Router();

router.use(authenticateRequest);
router.get('/types', listLeaveTypes);
router.get('/balances', listEmployeeLeaveBalances);
router.put('/balances/:employeeId', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), assignEmployeeLeaveBalances);
router.get('/requests', listLeaveRequests);
router.post('/requests', createLeaveRequest);
router.patch('/requests/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), decideLeaveRequest);

export default router;
