import { listBeds } from '../services/bedService.js';

async function getBeds(req, res) {
  const data = await listBeds({ access: req.user });
  res.json({ success: true, data });
}

export { getBeds };
