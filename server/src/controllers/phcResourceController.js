import { createHttpError, positiveIntQuery } from '../utils/http.js';
import {
  createAttendance,
  createBeds,
  createFootfall,
  createMedicineStock,
  deleteAttendance,
  deleteBeds,
  deleteFootfall,
  deleteMedicineStock,
  listAttendance,
  listBeds,
  listFootfall,
  listMedicineStock,
  updateAttendance,
  updateBeds,
  updateFootfall,
  updateMedicineStock,
} from '../services/phcResourceService.js';

function phcUser(req) {
  if (!req.user?.phcId) {
    throw createHttpError(403, 'You do not have permission to access this resource');
  }
  return req.user;
}

function resourceId(value, name) {
  const id = positiveIntQuery(value, name);
  if (!id) {
    throw createHttpError(400, `${name} must be a positive integer`);
  }
  return id;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createHttpError(400, `${field} is required`);
  }
  const text = value.trim();
  if (maxLength && text.length > maxLength) {
    throw createHttpError(400, `${field} must be ${maxLength} characters or fewer`);
  }
  return text;
}

function requiredDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createHttpError(400, `${field} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw createHttpError(400, `${field} must be a valid date`);
  }
  return value;
}

function nonNegative(value, field, { integer = false, greaterThan = null } = {}) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw createHttpError(400, `${field} must be a number`);
  }
  if (integer && !Number.isInteger(number)) {
    throw createHttpError(400, `${field} must be a whole number`);
  }
  if (greaterThan !== null && number <= greaterThan) {
    throw createHttpError(400, `${field} must be greater than ${greaterThan}`);
  }
  if (greaterThan === null && number < 0) {
    throw createHttpError(400, `${field} must be 0 or greater`);
  }
  return number;
}

function medicineInput(body) {
  return {
    medicineId: resourceId(String(body?.medicineId ?? ''), 'medicineId'),
    batchNumber: requiredText(body?.batchNumber, 'Batch number', 40),
    expiryDate: requiredDate(body?.expiryDate, 'Expiry date'),
    quantity: nonNegative(body?.quantity, 'Current quantity', { integer: true }),
    dailyUsage: nonNegative(body?.dailyUsage, 'Daily usage'),
  };
}

function medicineUpdateInput(body) {
  return {
    expiryDate: requiredDate(body?.expiryDate, 'Expiry date'),
    quantity: nonNegative(body?.quantity, 'Current quantity', { integer: true }),
    dailyUsage: nonNegative(body?.dailyUsage, 'Daily usage'),
  };
}

function footfallInput(body) {
  return {
    recordDate: requiredDate(body?.recordDate, 'Date'),
    visits: nonNegative(body?.visits, 'Patient visits', { integer: true }),
  };
}

function bedInput(body) {
  const totalBeds = nonNegative(body?.totalBeds, 'Total beds', { integer: true, greaterThan: 0 });
  const occupiedBeds = nonNegative(body?.occupiedBeds, 'Occupied beds', { integer: true });
  if (occupiedBeds > totalBeds) {
    throw createHttpError(400, 'Occupied beds cannot exceed total beds');
  }
  return { totalBeds, occupiedBeds };
}

function attendanceInput(body, { includePersonnel = false } = {}) {
  const input = {
    attendanceDate: requiredDate(body?.attendanceDate, 'Date'),
    status: requiredText(body?.status, 'Status', 20),
  };
  if (includePersonnel) {
    input.personnelId = resourceId(String(body?.personnelId ?? ''), 'personnelId');
  }
  return input;
}

async function getMedicineStock(req, res) {
  const data = await listMedicineStock(phcUser(req));
  res.json({ success: true, data });
}

async function postMedicineStock(req, res) {
  const id = await createMedicineStock(phcUser(req), medicineInput(req.body));
  const data = await listMedicineStock(phcUser(req));
  res.status(201).json({ success: true, data: { ...data, id } });
}

async function putMedicineStock(req, res) {
  const user = phcUser(req);
  await updateMedicineStock(user, resourceId(req.params.stockId, 'stockId'), medicineUpdateInput(req.body));
  res.json({ success: true, data: await listMedicineStock(user) });
}

async function removeMedicineStock(req, res) {
  const user = phcUser(req);
  await deleteMedicineStock(user, resourceId(req.params.stockId, 'stockId'));
  res.json({ success: true, data: await listMedicineStock(user), message: 'Record deleted successfully.' });
}

async function getFootfall(req, res) {
  res.json({ success: true, data: await listFootfall(phcUser(req)) });
}

async function postFootfall(req, res) {
  const user = phcUser(req);
  const id = await createFootfall(user, footfallInput(req.body));
  res.status(201).json({ success: true, data: { ...(await listFootfall(user)), id } });
}

async function putFootfall(req, res) {
  const user = phcUser(req);
  await updateFootfall(user, resourceId(req.params.recordId, 'recordId'), footfallInput(req.body));
  res.json({ success: true, data: await listFootfall(user) });
}

async function removeFootfall(req, res) {
  const user = phcUser(req);
  await deleteFootfall(user, resourceId(req.params.recordId, 'recordId'));
  res.json({ success: true, data: await listFootfall(user), message: 'Record deleted successfully.' });
}

async function getBeds(req, res) {
  res.json({ success: true, data: await listBeds(phcUser(req)) });
}

async function postBeds(req, res) {
  const user = phcUser(req);
  const id = await createBeds(user, bedInput(req.body));
  res.status(201).json({ success: true, data: { ...(await listBeds(user)), id } });
}

async function putBeds(req, res) {
  const user = phcUser(req);
  await updateBeds(user, resourceId(req.params.bedId, 'bedId'), bedInput(req.body));
  res.json({ success: true, data: await listBeds(user) });
}

async function removeBeds(req, res) {
  const user = phcUser(req);
  await deleteBeds(user, resourceId(req.params.bedId, 'bedId'));
  res.json({ success: true, data: await listBeds(user), message: 'Record deleted successfully.' });
}

async function getAttendance(req, res) {
  res.json({ success: true, data: await listAttendance(phcUser(req)) });
}

async function postAttendance(req, res) {
  const user = phcUser(req);
  const id = await createAttendance(user, attendanceInput(req.body, { includePersonnel: true }));
  res.status(201).json({ success: true, data: { ...(await listAttendance(user)), id } });
}

async function putAttendance(req, res) {
  const user = phcUser(req);
  await updateAttendance(user, resourceId(req.params.attendanceId, 'attendanceId'), attendanceInput(req.body));
  res.json({ success: true, data: await listAttendance(user) });
}

async function removeAttendance(req, res) {
  const user = phcUser(req);
  await deleteAttendance(user, resourceId(req.params.attendanceId, 'attendanceId'));
  res.json({ success: true, data: await listAttendance(user), message: 'Record deleted successfully.' });
}

export {
  getMedicineStock,
  postMedicineStock,
  putMedicineStock,
  removeMedicineStock,
  getFootfall,
  postFootfall,
  putFootfall,
  removeFootfall,
  getBeds,
  postBeds,
  putBeds,
  removeBeds,
  getAttendance,
  postAttendance,
  putAttendance,
  removeAttendance,
};
