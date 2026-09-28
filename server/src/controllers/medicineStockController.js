import { listMedicineStock } from '../services/medicineStockService.js';

async function getMedicineStock(req, res) {
  const data = await listMedicineStock({ access: req.user });
  res.json({ success: true, data });
}

export { getMedicineStock };
