// src/backup/service.js - JSON snapshot backup utility
const fs = require('fs');
const path = require('path');

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, data) {
  const tmp = `${filePath}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmp, filePath);
}

async function snapshotModel(prisma, modelName, where = {}) {
  try {
    if (!prisma[modelName] || typeof prisma[modelName].findMany !== 'function') return null;
    const list = await prisma[modelName].findMany({ where });
    return list;
  } catch (err) {
    return { error: err.message };
  }
}

async function runBackup({ prisma, outputDir = path.join(process.cwd(), 'backups'), organizationId = undefined }) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(outputDir, ts);
  await ensureDir(folder);

  const where = organizationId ? { organizationId } : {};

  const models = [
    'organization', 'user', 'product', 'order', 'orderItem', 'customer',
    'inventoryItem', 'location', 'store', 'story', 'crop'
  ];

  const index = { generatedAt: new Date().toISOString(), models: [], organizationId: organizationId || null };

  for (const name of models) {
    const data = await snapshotModel(prisma, name, where);
    if (data === null) continue;
    const file = path.join(folder, `${name}.json`);
    await writeJson(file, data);
    index.models.push({ name, count: Array.isArray(data) ? data.length : 0, file: path.basename(file) });
  }

  await writeJson(path.join(folder, 'index.json'), index);
  return { folder, index };
}

module.exports = { runBackup };


