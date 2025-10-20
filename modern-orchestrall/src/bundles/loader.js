// src/bundles/loader.js - Load and validate client Service Bundles
const fs = require('fs');
const path = require('path');

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function loadYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // minimal YAML support using JSON if possible; fallback naive parse
  try { return JSON.parse(content); } catch (_) { /* not JSON */ }
  // naive YAML: key: value pairs only (sufficient for our simple manifests)
  const obj = {};
  let current = obj;
  const stack = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([\s-]*)([^:]+):\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const key = m[2].trim();
    const val = m[3].trim();
    if (val === '') {
      current[key] = {};
      stack.push({ indent, current });
      current = current[key];
    } else {
      current[key] = val.replace(/^"|"$/g,'');
    }
  }
  return obj;
}

function normalize(bundleDoc) {
  if (!bundleDoc || !bundleDoc.bundle) throw new Error('Invalid bundle document');
  const b = bundleDoc.bundle;
  return {
    id: b.id,
    name: b.name,
    version: b.version,
    description: b.description || '',
    plugins: Array.isArray(b.plugins) ? b.plugins.map(p => ({ id: p.id, config: p.config || {} })) : [],
    env: b.env || {},
    featureFlags: b.featureFlags || {},
    permissions: Array.isArray(b.permissions) ? b.permissions : [],
    routes: Array.isArray(b.routes) ? b.routes : [],
    webhooks: Array.isArray(b.webhooks) ? b.webhooks : []
  };
}

function loadClientBundle(rootDir, clientId) {
  const manifest = path.join(rootDir, 'clients', clientId, 'bundles.yaml');
  if (!exists(manifest)) throw new Error(`Bundle manifest not found for client ${clientId}`);
  const doc = loadYaml(manifest);
  return normalize(doc);
}

module.exports = { loadClientBundle };


