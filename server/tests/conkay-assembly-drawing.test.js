/**
 * Orthographic drawing projection unit test (no HTTP).
 * Run: node --test server/tests/conkay-assembly-drawing.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { projectMeshView, viewsToSvg, exportPartDrawing } from '../lib/conkay/assembly-drawing.js';

describe('conkay assembly drawing', () => {
  const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1];
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 0, 3, 7, 0, 7, 4, 1, 2, 6, 1, 6, 5,
  ];

  it('projects front/top/side with segments', () => {
    for (const view of ['front', 'top', 'side']) {
      const v = projectMeshView(positions, indices, view);
      assert.ok(v.edgeCount > 0);
      assert.ok(v.segments.length > 0);
      assert.equal(v.view, view);
    }
  });

  it('viewsToSvg emits FRONT/TOP/SIDE', () => {
    const views = ['front', 'top', 'side'].map((v) => projectMeshView(positions, indices, v));
    const svg = viewsToSvg(views);
    assert.match(svg, /<svg/);
    assert.match(svg, /FRONT/);
    assert.match(svg, /TOP/);
    assert.match(svg, /SIDE/);
  });

  it('exportPartDrawing returns svg + views', () => {
    const part = {
      id: 'p1',
      name: 'box',
      mesh: { positions, indices },
      transform: { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    };
    const out = exportPartDrawing(part);
    assert.equal(out.ok, true);
    assert.equal(out.views.length, 3);
    assert.match(out.svg, /<svg/);
  });
});
