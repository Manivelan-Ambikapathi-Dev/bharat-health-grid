import { listPhcs } from '../services/phcService.js';
import { textQuery } from '../utils/http.js';

async function getPhcs(req, res) {
  const data = await listPhcs({
    state: textQuery(req.query.state),
    district: textQuery(req.query.district),
    access: req.user,
  });
  res.json({ success: true, data });
}

export { getPhcs };
