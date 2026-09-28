import { listAttendance } from '../services/attendanceService.js';
import { dateQuery, textQuery } from '../utils/http.js';

async function getAttendance(req, res) {
  const data = await listAttendance({
    date: dateQuery(req.query.date, 'date'),
    state: textQuery(req.query.state),
    access: req.user,
  });
  res.json({ success: true, data });
}

export { getAttendance };
