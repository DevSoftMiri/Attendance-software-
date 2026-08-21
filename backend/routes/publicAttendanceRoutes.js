import { Router } from 'express';
import { identify, publicCheckIn, publicCheckOut } from '../controllers/publicAttendanceController.js';

const router = Router();

router.post('/identify', identify);
router.post('/check-in', publicCheckIn);
router.post('/check-out', publicCheckOut);

export default router;
