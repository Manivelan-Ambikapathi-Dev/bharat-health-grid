import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(scriptDir, '../../database');
const destDir = path.resolve(scriptDir, '../database');
const fileNames = ['schema.sql', 'seed_users.sql'];

function filesExist(directory) {
  return fileNames.every((fileName) => fs.existsSync(path.join(directory, fileName)));
}

if (filesExist(sourceDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const fileName of fileNames) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(destDir, fileName));
  }
  console.log('Copied schema.sql and seed_users.sql into server/database.');
} else if (filesExist(destDir)) {
  console.log('Using schema.sql and seed_users.sql already present in server/database.');
} else {
  console.error(
    'Could not copy database/schema.sql and database/seed_users.sql into server/database. The Railway service root directory must be the repository root so this build can read the database folder.',
  );
  process.exit(1);
}
