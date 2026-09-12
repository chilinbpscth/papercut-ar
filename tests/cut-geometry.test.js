import test from 'node:test'
import assert from 'node:assert/strict'
import { raySegHit, polygonArea } from '../src/cut-geometry.js'

test('fold ray intersects a stroke crossing its middle in either direction', () => {
  for (const [a, b] of [[{x: -10, y: -50}, {x: 10, y: -50}], [{x: 10, y: -50}, {x: -10, y: -50}]]) {
    const hit = raySegHit(0, 0, -Math.PI / 2, a, b)
    assert.ok(hit)
    assert.ok(Math.abs(hit.x) < 1e-8)
    assert.equal(hit.y, -50)
  }
})
test('does not extend a segment or ray to invent an intersection', () => {
  assert.equal(raySegHit(0, 0, -Math.PI / 2, {x: 10, y: -50}, {x: 20, y: -50}), null)
  assert.equal(raySegHit(0, 0, -Math.PI / 2, {x: -10, y: 50}, {x: 10, y: 50}), null)
})
test('collinear cuts enclose no area while a loop has area in either direction', () => {
  assert.equal(polygonArea([{x:0,y:0},{x:10,y:10},{x:20,y:20}]), 0)
  const triangle = [{x:0,y:0},{x:20,y:0},{x:0,y:20}]
  assert.equal(polygonArea(triangle), 200)
  assert.equal(polygonArea(triangle.toReversed()), 200)
})
