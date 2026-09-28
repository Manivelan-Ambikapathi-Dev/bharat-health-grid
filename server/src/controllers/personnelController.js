import { listPersonnel } from '../services/personnelService.js';

async function getPersonnel(req, res) {
  const data = await listPersonnel({ access: req.user });
  res.json({ success: true, data });
}

export { getPersonnel };
