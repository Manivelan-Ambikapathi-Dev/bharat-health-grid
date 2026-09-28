import { Router } from 'express';
import { getMedicineStock } from '../controllers/medicineStockController.js';

const medicineStockRouter = Router();

medicineStockRouter.get('/', getMedicineStock);

export { medicineStockRouter };
