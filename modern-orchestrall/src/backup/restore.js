// src/backup/restore.js - Restore JSON snapshot into database (safe, best-effort)
const fs = require('fs');
const path = require('path');

async function readJson(filePath) {
  const buf = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(buf);
}

async function restoreModel(prisma, modelName, items = [], { mode = 'create-only' } = {}) {
  if (!prisma[modelName] || typeof prisma[modelName].create !== 'function') return { model: modelName, skipped: true };
  const results = { model: modelName, total: items.length, created: 0, updated: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      // Prefer id if present; otherwise let DB generate
      if (mode === 'upsert' && item.id && typeof prisma[modelName].upsert === 'function') {
        await prisma[modelName].upsert({
          where: { id: item.id },
          update: item,
          create: item,
        });
        results.updated += 1;
      } else {
        await prisma[modelName].create({ data: item });
        results.created += 1;
      }
    } catch (err) {
      results.failed += 1;
      results.errors.push({ id: item.id, error: err.message });
    }
  }
  return results;
}

async function restoreFromSnapshot({ prisma, folder, organizationId = undefined, mode = 'create-only' }) {
  const indexPath = path.join(folder, 'index.json');
  const index = await readJson(indexPath);
  const summary = { folder, organizationId: organizationId || null, mode, models: [] };

  for (const m of index.models || []) {
    const file = path.join(folder, m.file);
    try {
      const data = await readJson(file);
      const filtered = organizationId ? (Array.isArray(data) ? data.filter(d => d.organizationId === organizationId) : []) : data;
      const res = await restoreModel(prisma, m.name, filtered, { mode });
      summary.models.push(res);
    } catch (err) {
      summary.models.push({ model: m.name, total: 0, created: 0, updated: 0, failed: 0, error: err.message });
    }
  }
  return summary;
}

module.exports = { restoreFromSnapshot };


