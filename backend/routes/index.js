import { Router } from 'express';
import authRoutes from './authRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import payrollRoutes from './payrollRoutes.js';
import salaryStructureRoutes from './salaryStructureRoutes.js';
import reportRoutes from './reportRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import faceRoutes from './faceRoutes.js';
import publicAttendanceRoutes from './publicAttendanceRoutes.js';

const router = Router();

router.get('/health', (request, response) => {
    response.json({ status: 'ok', service: 'attendance-backend' });
});

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave', leaveRoutes);
router.use('/payroll', payrollRoutes);
router.use('/salary-structures', salaryStructureRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/face', faceRoutes);
router.use('/public-attendance', publicAttendanceRoutes);

export default router;
