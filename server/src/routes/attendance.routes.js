import { Router } from 'express';
import { getAttendance } from '../controllers/attendanceController.js';

const attendanceRouter = Router();

attendanceRouter.get('/', getAttendance);

export { attendanceRouter };
