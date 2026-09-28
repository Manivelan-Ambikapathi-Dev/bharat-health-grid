import { query } from '../config/db.js';
import { toNumber, createHttpError } from '../utils/http.js';
import { stockDaysSql, stockStatusSql } from './stockRules.js';
import { FORBIDDEN_MESSAGE } from '../middleware/rbacMiddleware.js';

const ATTENDANCE_STATUSES = new Set(['Present', 'Absent', 'Leave']);
const PRESENT_CHECK_IN = '09:00:00';
const PRESENT_CHECK_OUT = '17:00:00';

function logResourceAction({ user, resourceType, resourceId, action }) {
  console.info(JSON.stringify({
    action,
    resourceType,
    resourceId: resourceId ?? null,
    userId: user.id,
    username: user.username,
    role: user.role,
    phcId: user.phcId,
    timestamp: new Date().toISOString(),
  }));
}

function forbidden() {
  return createHttpError(403, FORBIDDEN_MESSAGE);
}

function isDuplicate(error) {
  return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
}

function dayBefore(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function phcProfile(phcId) {
  const rows = await query(
    `SELECT p.id, p.name, p.phc_code, d.name AS district, s.name AS state
     FROM phcs p
     JOIN districts d ON d.id = p.district_id
     JOIN states s ON s.id = d.state_id
     WHERE p.id = :phcId`,
    { phcId },
  );
  return rows[0] || null;
}

async function ownedRow(sql, params, phcId) {
  const rows = await query(sql, params);
  const row = rows[0];
  if (!row) {
    throw createHttpError(404, 'Record not found');
  }
  if (Number(row.phc_id) !== Number(phcId)) {
    throw forbidden();
  }
  return row;
}

function mapMedicine(row) {
  return {
    id: row.id,
    medicine_id: row.medicine_id,
    medicine: row.medicine,
    batch_number: row.batch_number,
    expiry_date: row.expiry_date,
    current_quantity: toNumber(row.current_quantity),
    daily_average_usage: toNumber(row.daily_average_usage),
    stock_days: toNumber(row.stock_days),
    stock_status: row.stock_status,
    updated_at: row.updated_at,
  };
}

async function listMedicineStock(user) {
  const phcId = user.phcId;
  const [phc, medicines, records] = await Promise.all([
    phcProfile(phcId),
    query('SELECT id, name FROM medicines ORDER BY name'),
    query(
      `SELECT
         ms.id,
         ms.medicine_id,
         m.name AS medicine,
         ms.batch_number,
         ms.expiry_date,
         ms.current_quantity,
         ms.daily_average_usage,
         ${stockDaysSql} AS stock_days,
         ${stockStatusSql} AS stock_status,
         ms.updated_at
       FROM medicine_stock ms
       JOIN medicines m ON m.id = ms.medicine_id
       WHERE ms.phc_id = :phcId
       ORDER BY m.name, ms.batch_number`,
      { phcId },
    ),
  ]);
  logResourceAction({ user, resourceType: 'medicine_stock', action: 'READ' });
  return {
    phc,
    medicines,
    records: records.map(mapMedicine),
  };
}

async function createMedicineStock(user, input) {
  const phcId = user.phcId;
  const medicines = await query('SELECT id FROM medicines WHERE id = :id', { id: input.medicineId });
  if (!medicines[0]) {
    throw createHttpError(400, 'Medicine is required');
  }
  try {
    const result = await query(
      `INSERT INTO medicine_stock (
         phc_id, medicine_id, batch_number, quantity_received, current_quantity,
         daily_average_usage, received_date, expiry_date, supplier_name
       ) VALUES (
         :phcId, :medicineId, :batchNumber, :quantity, :quantity,
         :usage, :receivedDate, :expiryDate, :supplier
       )`,
      {
        phcId,
        medicineId: input.medicineId,
        batchNumber: input.batchNumber,
        quantity: input.quantity,
        usage: input.dailyUsage,
        receivedDate: dayBefore(input.expiryDate),
        expiryDate: input.expiryDate,
        supplier: 'PHC staff entry',
      },
    );
    logResourceAction({
      user,
      resourceType: 'medicine_stock',
      resourceId: result.insertId,
      action: 'CREATE',
    });
    return result.insertId;
  } catch (error) {
    if (isDuplicate(error)) {
      throw createHttpError(400, 'A stock record for this medicine and batch already exists at this PHC.');
    }
    throw error;
  }
}

async function updateMedicineStock(user, stockId, input) {
  const existing = await ownedRow(
    `SELECT id, phc_id, quantity_received, received_date
     FROM medicine_stock
     WHERE id = :id`,
    { id: stockId },
    user.phcId,
  );
  const quantityReceived = Math.max(Number(existing.quantity_received), input.quantity);
  const receivedDate = String(existing.received_date) >= input.expiryDate
    ? dayBefore(input.expiryDate)
    : existing.received_date;
  await query(
    `UPDATE medicine_stock
     SET expiry_date = :expiryDate,
         current_quantity = :quantity,
         quantity_received = :quantityReceived,
         daily_average_usage = :usage,
         received_date = :receivedDate
     WHERE id = :id AND phc_id = :phcId`,
    {
      id: stockId,
      phcId: user.phcId,
      expiryDate: input.expiryDate,
      quantity: input.quantity,
      quantityReceived,
      usage: input.dailyUsage,
      receivedDate,
    },
  );
  logResourceAction({ user, resourceType: 'medicine_stock', resourceId: stockId, action: 'UPDATE' });
}

async function deleteMedicineStock(user, stockId) {
  await ownedRow(
    'SELECT id, phc_id FROM medicine_stock WHERE id = :id',
    { id: stockId },
    user.phcId,
  );
  await query(
    'DELETE FROM medicine_stock WHERE id = :id AND phc_id = :phcId',
    { id: stockId, phcId: user.phcId },
  );
  logResourceAction({ user, resourceType: 'medicine_stock', resourceId: stockId, action: 'DELETE' });
}

function mapFootfall(row) {
  return {
    id: row.id,
    record_date: row.record_date,
    total_patients: toNumber(row.total_patients),
    created_at: row.created_at,
  };
}

async function listFootfall(user) {
  const records = await query(
    `SELECT id, record_date, total_patients, created_at
     FROM patient_footfall
     WHERE phc_id = :phcId
     ORDER BY record_date DESC`,
    { phcId: user.phcId },
  );
  logResourceAction({ user, resourceType: 'patient_footfall', action: 'READ' });
  return { records: records.map(mapFootfall) };
}

async function createFootfall(user, input) {
  try {
    const result = await query(
      `INSERT INTO patient_footfall (
         phc_id, record_date, total_patients, emergency_patients, outpatient_patients
       ) VALUES (
         :phcId, :recordDate, :visits, 0, :visits
       )`,
      { phcId: user.phcId, recordDate: input.recordDate, visits: input.visits },
    );
    logResourceAction({
      user,
      resourceType: 'patient_footfall',
      resourceId: result.insertId,
      action: 'CREATE',
    });
    return result.insertId;
  } catch (error) {
    if (isDuplicate(error)) {
      throw createHttpError(400, 'A patient footfall record already exists for this date.');
    }
    throw error;
  }
}

async function updateFootfall(user, recordId, input) {
  await ownedRow(
    'SELECT id, phc_id FROM patient_footfall WHERE id = :id',
    { id: recordId },
    user.phcId,
  );
  const clash = await query(
    `SELECT id FROM patient_footfall
     WHERE phc_id = :phcId AND record_date = :recordDate AND id <> :id`,
    { phcId: user.phcId, recordDate: input.recordDate, id: recordId },
  );
  if (clash[0]) {
    throw createHttpError(400, 'A patient footfall record already exists for this date.');
  }
  await query(
    `UPDATE patient_footfall
     SET record_date = :recordDate,
         total_patients = :visits,
         emergency_patients = 0,
         outpatient_patients = :visits
     WHERE id = :id AND phc_id = :phcId`,
    { id: recordId, phcId: user.phcId, recordDate: input.recordDate, visits: input.visits },
  );
  logResourceAction({ user, resourceType: 'patient_footfall', resourceId: recordId, action: 'UPDATE' });
}

async function deleteFootfall(user, recordId) {
  await ownedRow(
    'SELECT id, phc_id FROM patient_footfall WHERE id = :id',
    { id: recordId },
    user.phcId,
  );
  await query(
    'DELETE FROM patient_footfall WHERE id = :id AND phc_id = :phcId',
    { id: recordId, phcId: user.phcId },
  );
  logResourceAction({ user, resourceType: 'patient_footfall', resourceId: recordId, action: 'DELETE' });
}

function mapBed(row) {
  return {
    id: row.id,
    total_beds: toNumber(row.total_beds),
    occupied_beds: toNumber(row.occupied_beds),
    available_beds: toNumber(row.available_beds),
    occupancy_percentage: toNumber(row.occupancy_percentage),
    last_updated: row.last_updated,
  };
}

async function listBeds(user) {
  const rows = await query(
    `SELECT
       id,
       total_beds,
       occupied_beds,
       available_beds,
       CASE
         WHEN total_beds = 0 THEN 0
         ELSE ROUND(100 * occupied_beds / total_beds, 1)
       END AS occupancy_percentage,
       last_updated
     FROM beds
     WHERE phc_id = :phcId`,
    { phcId: user.phcId },
  );
  logResourceAction({ user, resourceType: 'beds', action: 'READ' });
  return { configuration: rows[0] ? mapBed(rows[0]) : null };
}

async function createBeds(user, input) {
  const existing = await query('SELECT id FROM beds WHERE phc_id = :phcId', { phcId: user.phcId });
  if (existing[0]) {
    throw createHttpError(400, 'This PHC already has a bed configuration. Update the existing record.');
  }
  const available = input.totalBeds - input.occupiedBeds;
  const result = await query(
    `INSERT INTO beds (phc_id, total_beds, occupied_beds, available_beds, last_updated)
     VALUES (:phcId, :totalBeds, :occupiedBeds, :availableBeds, NOW())`,
    {
      phcId: user.phcId,
      totalBeds: input.totalBeds,
      occupiedBeds: input.occupiedBeds,
      availableBeds: available,
    },
  );
  logResourceAction({ user, resourceType: 'beds', resourceId: result.insertId, action: 'CREATE' });
  return result.insertId;
}

async function updateBeds(user, bedId, input) {
  await ownedRow('SELECT id, phc_id FROM beds WHERE id = :id', { id: bedId }, user.phcId);
  const available = input.totalBeds - input.occupiedBeds;
  await query(
    `UPDATE beds
     SET total_beds = :totalBeds,
         occupied_beds = :occupiedBeds,
         available_beds = :availableBeds,
         last_updated = NOW()
     WHERE id = :id AND phc_id = :phcId`,
    {
      id: bedId,
      phcId: user.phcId,
      totalBeds: input.totalBeds,
      occupiedBeds: input.occupiedBeds,
      availableBeds: available,
    },
  );
  logResourceAction({ user, resourceType: 'beds', resourceId: bedId, action: 'UPDATE' });
}

async function deleteBeds(user, bedId) {
  await ownedRow('SELECT id, phc_id FROM beds WHERE id = :id', { id: bedId }, user.phcId);
  await query('DELETE FROM beds WHERE id = :id AND phc_id = :phcId', { id: bedId, phcId: user.phcId });
  logResourceAction({ user, resourceType: 'beds', resourceId: bedId, action: 'DELETE' });
}

function mapAttendance(row) {
  return {
    id: row.id,
    personnel_id: row.personnel_id,
    personnel: row.personnel,
    role: row.role,
    attendance_date: row.attendance_date,
    status: row.status,
    created_at: row.created_at,
  };
}

async function listAttendance(user) {
  const [personnel, records] = await Promise.all([
    query(
      `SELECT id, name, role
       FROM personnel
       WHERE phc_id = :phcId
       ORDER BY role, name`,
      { phcId: user.phcId },
    ),
    query(
      `SELECT
         a.id,
         a.personnel_id,
         pe.name AS personnel,
         pe.role,
         a.attendance_date,
         a.status,
         a.created_at
       FROM personnel_attendance a
       JOIN personnel pe ON pe.id = a.personnel_id AND pe.phc_id = a.phc_id
       WHERE a.phc_id = :phcId
       ORDER BY a.attendance_date DESC, pe.name`,
      { phcId: user.phcId },
    ),
  ]);
  logResourceAction({ user, resourceType: 'personnel_attendance', action: 'READ' });
  return {
    personnel,
    statuses: [...ATTENDANCE_STATUSES],
    records: records.map(mapAttendance),
  };
}

async function personnelInPhc(personnelId, phcId) {
  const rows = await query(
    'SELECT id, phc_id FROM personnel WHERE id = :id',
    { id: personnelId },
  );
  if (!rows[0]) {
    throw createHttpError(400, 'Personnel is required');
  }
  if (Number(rows[0].phc_id) !== Number(phcId)) {
    throw forbidden();
  }
}

async function createAttendance(user, input) {
  if (!ATTENDANCE_STATUSES.has(input.status)) {
    throw createHttpError(400, 'Status must be Present, Absent, or Leave');
  }
  await personnelInPhc(input.personnelId, user.phcId);
  const present = input.status === 'Present';
  try {
    const result = await query(
      `INSERT INTO personnel_attendance (
         personnel_id, phc_id, attendance_date, status, check_in, check_out
       ) VALUES (
         :personnelId, :phcId, :attendanceDate, :status, :checkIn, :checkOut
       )`,
      {
        personnelId: input.personnelId,
        phcId: user.phcId,
        attendanceDate: input.attendanceDate,
        status: input.status,
        checkIn: present ? PRESENT_CHECK_IN : null,
        checkOut: present ? PRESENT_CHECK_OUT : null,
      },
    );
    logResourceAction({
      user,
      resourceType: 'personnel_attendance',
      resourceId: result.insertId,
      action: 'CREATE',
    });
    return result.insertId;
  } catch (error) {
    if (isDuplicate(error)) {
      throw createHttpError(400, 'An attendance record already exists for this person on this date.');
    }
    throw error;
  }
}

async function updateAttendance(user, attendanceId, input) {
  if (!ATTENDANCE_STATUSES.has(input.status)) {
    throw createHttpError(400, 'Status must be Present, Absent, or Leave');
  }
  const existing = await ownedRow(
    'SELECT id, phc_id, personnel_id FROM personnel_attendance WHERE id = :id',
    { id: attendanceId },
    user.phcId,
  );
  const clash = await query(
    `SELECT id FROM personnel_attendance
     WHERE personnel_id = :personnelId AND attendance_date = :attendanceDate AND id <> :id`,
    { personnelId: existing.personnel_id, attendanceDate: input.attendanceDate, id: attendanceId },
  );
  if (clash[0]) {
    throw createHttpError(400, 'An attendance record already exists for this person on this date.');
  }
  const present = input.status === 'Present';
  await query(
    `UPDATE personnel_attendance
     SET attendance_date = :attendanceDate,
         status = :status,
         check_in = :checkIn,
         check_out = :checkOut
     WHERE id = :id AND phc_id = :phcId`,
    {
      id: attendanceId,
      phcId: user.phcId,
      attendanceDate: input.attendanceDate,
      status: input.status,
      checkIn: present ? PRESENT_CHECK_IN : null,
      checkOut: present ? PRESENT_CHECK_OUT : null,
    },
  );
  logResourceAction({
    user,
    resourceType: 'personnel_attendance',
    resourceId: attendanceId,
    action: 'UPDATE',
  });
}

async function deleteAttendance(user, attendanceId) {
  await ownedRow(
    'SELECT id, phc_id FROM personnel_attendance WHERE id = :id',
    { id: attendanceId },
    user.phcId,
  );
  await query(
    'DELETE FROM personnel_attendance WHERE id = :id AND phc_id = :phcId',
    { id: attendanceId, phcId: user.phcId },
  );
  logResourceAction({
    user,
    resourceType: 'personnel_attendance',
    resourceId: attendanceId,
    action: 'DELETE',
  });
}

export {
  listMedicineStock,
  createMedicineStock,
  updateMedicineStock,
  deleteMedicineStock,
  listFootfall,
  createFootfall,
  updateFootfall,
  deleteFootfall,
  listBeds,
  createBeds,
  updateBeds,
  deleteBeds,
  listAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
};
