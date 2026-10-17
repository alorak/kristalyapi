#!/usr/bin/env node
/* P10.8.5: export original and resampled real fields for scientific diagnostics. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {parse, gridLike} = require('./volume-highres-gate.cjs');

const source = process.argv[2];
const directory = process.argv[3];
const label = process.argv[4];
const tail = process.argv[5];
if (!source || !directory || !label || !['positive', 'negative'].includes(tail)) {
  throw Error('Usage: node volume-sampling-grid.cjs source.ccp4 out-dir label positive|negative');
}

const original = parse.ccp4Read(fs.readFileSync(source), path.basename(source));
assert.ok(original.dims.every(n => Number.isInteger(n) && n >= 2));
assert.ok(original.values.length <= 2500000, 'Source exceeds reader voxel budget');

function writeGrid(grid, suffix) {
  const values = Float32Array.from(grid.values);
  assert.equal(values.length, grid.dims.reduce((a, b) => a * b, 1));
  assert.ok(values.every(Number.isFinite), 'Nonfinite scientific scalar');
  assert.ok(grid.axes.flat().every(Number.isFinite), 'Nonfinite voxel basis');
  const name = `${label}-${suffix}.float32`;
  fs.writeFileSync(path.join(directory, name),
    Buffer.from(values.buffer, values.byteOffset, values.byteLength));
  return {file: name, dims: [...grid.dims], periodic: !!grid.periodic,
    axes: grid.axes.map(axis => [...axis]), origin: [...grid.origin]};
}

const manifest = {
  protocol: 'p10.8.5-source-and-resampling', label, tail,
  sourceFile: path.basename(source),
  scalarUnits: 'source map scale (not independently calibrated)',
  method: 'actual CCP4 parser and production Worker trilinear sampling',
  original: writeGrid(original, 'original'),
  sampled: [32, 48, 64].map(n => ({n, ...writeGrid(gridLike(original, n), String(n))})),
};
fs.writeFileSync(path.join(directory, `${label}-sampling.json`), JSON.stringify(manifest, null, 2));
process.stdout.write(JSON.stringify({label, grids: manifest.sampled.map(g => g.n)}) + '\n');
