export function raySegHit(cx, cy, angle, p1, p2) {
  const rx = Math.cos(angle), ry = Math.sin(angle)
  const sx = p2.x - p1.x, sy = p2.y - p1.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-8) return null
  const qx = p1.x - cx, qy = p1.y - cy
  const tRay = (qx * sy - qy * sx) / den
  const tSeg = (qx * ry - qy * rx) / den
  if (tRay >= 0 && tSeg >= 0 && tSeg <= 1) {
    return { x: cx + rx * tRay, y: cy + ry * tRay, tRay }
  }
  return null
}

export function polygonArea(pts) {
  return Math.abs(pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length]
    return sum + p.x * q.y - q.x * p.y
  }, 0)) / 2
}
