import { listAlerts } from '../services/alertService.js';
import { filterRowsByScope } from '../auth/scopeSql.js';

async function getAlerts(req, res) {
  const data = filterRowsByScope(await listAlerts(), req.user);
  res.json({ success: true, data });
}

export { getAlerts };
