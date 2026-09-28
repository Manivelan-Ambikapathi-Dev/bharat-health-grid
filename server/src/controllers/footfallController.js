import { listFootfall } from '../services/footfallService.js';
import { createHttpError, dateQuery, positiveIntQuery } from '../utils/http.js';

async function getFootfall(req, res) {
  const from = dateQuery(req.query.from, 'from');
  const to = dateQuery(req.query.to, 'to');
  if (from && to && from > to) {
    throw createHttpError(400, 'from must be on or before to');
  }

  const data = await listFootfall({
    phcId: positiveIntQuery(req.query.phc_id, 'phc_id'),
    from,
    to,
    access: req.user,
  });
  res.json({ success: true, data });
}

export { getFootfall };
