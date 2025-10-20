// src/bundles/apply.js - Apply Service Bundle to a client (dry run or apply)
async function diffAndApply({ prisma, clientId, bundle, dryRun = true }) {
  // For now, diff covers plugins enablement only; future: routes, webhooks, permissions
  const planned = [];
  for (const p of bundle.plugins) {
    planned.push({ action: 'enablePlugin', pluginId: p.id, config: p.config || {} });
  }
  if (dryRun) return { dryRun: true, planned };
  // Apply actions (placeholder): in real impl, call plugin manager
  const applied = [];
  for (const step of planned) {
    applied.push({ ...step, status: 'ok' });
  }
  return { dryRun: false, applied };
}

module.exports = { diffAndApply };


