import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import {
  getAttendance,
  getBeds,
  getFootfall,
  getMedicineStock,
  postAttendance,
  postBeds,
  postFootfall,
  postMedicineStock,
  putAttendance,
  putBeds,
  putFootfall,
  putMedicineStock,
  removeAttendance,
  removeBeds,
  removeFootfall,
  removeMedicineStock,
} from '../controllers/phcResourceController.js';

const phcResourceRouter = Router();

phcResourceRouter.use(requireRole(ROLES.PHC_STAFF));

phcResourceRouter.get('/medicine-stock', getMedicineStock);
phcResourceRouter.post('/medicine-stock', postMedicineStock);
phcResourceRouter.put('/medicine-stock/:stockId', putMedicineStock);
phcResourceRouter.delete('/medicine-stock/:stockId', removeMedicineStock);

phcResourceRouter.get('/patient-footfall', getFootfall);
phcResourceRouter.post('/patient-footfall', postFootfall);
phcResourceRouter.put('/patient-footfall/:recordId', putFootfall);
phcResourceRouter.delete('/patient-footfall/:recordId', removeFootfall);

phcResourceRouter.get('/beds', getBeds);
phcResourceRouter.post('/beds', postBeds);
phcResourceRouter.put('/beds/:bedId', putBeds);
phcResourceRouter.delete('/beds/:bedId', removeBeds);

phcResourceRouter.get('/attendance', getAttendance);
phcResourceRouter.post('/attendance', postAttendance);
phcResourceRouter.put('/attendance/:attendanceId', putAttendance);
phcResourceRouter.delete('/attendance/:attendanceId', removeAttendance);

export { phcResourceRouter };
