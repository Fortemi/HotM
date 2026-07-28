#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function collectFiles(roots, outputPath) {
  const outputResolved = path.resolve(outputPath);
  const files = [];

  function walk(root, current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(root, resolved);
      } else if (entry.isFile() && path.resolve(resolved) !== outputResolved) {
        const stat = fs.statSync(resolved);
        files.push({
          path: toPosix(path.relative(root, resolved)),
          root: toPosix(root),
          bytes: stat.size,
          sha256: sha256File(resolved),
        });
      }
    }
  }

  for (const root of roots) {
    walk(path.normalize(root), path.normalize(root));
  }

  return files.sort((left, right) =>
    `${left.root}/${left.path}`.localeCompare(`${right.root}/${right.path}`),
  );
}

function validateReceiptArtifactManifest(manifest, manifestPath = null) {
  const failures = [];
  if (manifest.schemaVersion !== 'hotm.receipt-artifact-manifest.v1') {
    failures.push('schemaVersion mismatch');
  }
  if (manifest.issue !== 'Fortemi/HotM#283') failures.push('issue mismatch');
  if (typeof manifest.artifact !== 'string' || manifest.artifact.length === 0) {
    failures.push('artifact missing');
  }
  if (typeof manifest.generated_at !== 'string' || manifest.generated_at.length === 0) {
    failures.push('generated_at missing');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    failures.push('files must be a non-empty array');
    return failures;
  }

  let previousKey = null;
  const seen = new Set();
  const manifestResolved = manifestPath ? path.resolve(manifestPath) : null;
  for (const [index, file] of manifest.files.entries()) {
    const prefix = `files[${index}]`;
    if (typeof file.root !== 'string' || file.root.length === 0) {
      failures.push(`${prefix}.root missing`);
      continue;
    }
    if (typeof file.path !== 'string' || file.path.length === 0) {
      failures.push(`${prefix}.path missing`);
      continue;
    }
    if (!Number.isInteger(file.bytes) || file.bytes < 0) failures.push(`${prefix}.bytes invalid`);
    if (typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      failures.push(`${prefix}.sha256 invalid`);
    }

    const key = `${file.root}/${file.path}`;
    if (previousKey !== null && previousKey.localeCompare(key) > 0) {
      failures.push('files must be sorted by root/path');
    }
    previousKey = key;
    if (seen.has(key)) failures.push(`duplicate file entry: ${key}`);
    seen.add(key);

    const resolved = path.resolve(file.root, file.path);
    if (manifestResolved !== null && resolved === manifestResolved) {
      failures.push('manifest must not include itself');
      continue;
    }
    let stat = null;
    try {
      stat = fs.statSync(resolved);
    } catch {
      failures.push(`missing file: ${key}`);
      continue;
    }
    if (!stat.isFile()) {
      failures.push(`not a file: ${key}`);
      continue;
    }
    if (Number.isInteger(file.bytes) && stat.size !== file.bytes) {
      failures.push(`byte count mismatch: ${key}`);
    }
    if (/^[0-9a-f]{64}$/.test(file.sha256 || '') && sha256File(resolved) !== file.sha256) {
      failures.push(`sha256 mismatch: ${key}`);
    }
  }

  return failures;
}

function verifyReceiptArtifactManifest(manifestPath) {
  const failures = [];
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    failures.push(`could not read manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest !== null) {
    failures.push(...validateReceiptArtifactManifest(manifest, manifestPath));
  }

  const validation = {
    receipt: 'hotm-receipt-artifact-manifest-validation',
    issue: 'Fortemi/HotM#283',
    status: failures.length === 0 ? 'passed' : 'failed',
    manifest_path: manifestPath,
    artifact: manifest?.artifact || null,
    files: Array.isArray(manifest?.files) ? manifest.files.length : 0,
    failures,
  };
  return validation;
}

function writeReceiptArtifactManifest({
  outputPath,
  artifact,
  roots,
  issue = 'Fortemi/HotM#283',
  now = new Date(),
  env = process.env,
}) {
  if (!outputPath) throw new Error('outputPath is required');
  if (!artifact) throw new Error('artifact is required');
  if (!Array.isArray(roots) || roots.length === 0) throw new Error('at least one root is required');

  const manifest = {
    schemaVersion: 'hotm.receipt-artifact-manifest.v1',
    issue,
    artifact,
    generated_at: now.toISOString(),
    git: {
      repository: env.GITHUB_REPOSITORY || null,
      sha: env.GITHUB_SHA || null,
      ref: env.GITHUB_REF || null,
      run_id: env.GITHUB_RUN_ID || null,
    },
    files: collectFiles(roots, outputPath),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) {
  const [modeOrOutputPath, maybeArtifact, ...roots] = process.argv.slice(2);
  try {
    if (modeOrOutputPath === '--verify') {
      const validation = verifyReceiptArtifactManifest(maybeArtifact);
      if (validation.failures.length > 0) {
        console.error(validation.failures.join('\n'));
        process.exit(1);
      }
    } else {
      writeReceiptArtifactManifest({
        outputPath: modeOrOutputPath,
        artifact: maybeArtifact,
        roots,
      });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

module.exports = {
  collectFiles,
  validateReceiptArtifactManifest,
  verifyReceiptArtifactManifest,
  writeReceiptArtifactManifest,
};
