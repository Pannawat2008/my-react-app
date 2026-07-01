/**
 * airfoilParser.js
 * Utility to parse standard .dat airfoil files (Selig/Lednicer)
 * and provide an interpolator for upper and lower surfaces.
 */

export function parseDatFile(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Skip the first line (usually the airfoil name)
  const dataLines = lines.slice(1);
  
  const points = [];
  for (const line of dataLines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }
  }

  // Find the leading edge (minimum x)
  let minX = Infinity;
  let minIndex = -1;
  points.forEach((pt, i) => {
    if (pt.x < minX) {
      minX = pt.x;
      minIndex = i;
    }
  });

  // Split into upper and lower surfaces based on LE index
  // Most Selig format files start at TE, go over upper to LE, then lower to TE
  // E.g. x goes 1 -> 0 -> 1
  let upper = points.slice(0, minIndex + 1).reverse(); // Make it go from 0 -> 1
  let lower = points.slice(minIndex); // Goes from 0 -> 1

  // Function to linearly interpolate a set of points sorted by x (ascending)
  const interpolate = (pts, targetX) => {
    if (targetX <= pts[0].x) return pts[0].y;
    if (targetX >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

    // Find the segment
    for (let i = 0; i < pts.length - 1; i++) {
      if (targetX >= pts[i].x && targetX <= pts[i + 1].x) {
        const t = (targetX - pts[i].x) / (pts[i + 1].x - pts[i].x);
        return pts[i].y + t * (pts[i + 1].y - pts[i].y);
      }
    }
    return 0;
  };

  // Find max thickness by sampling
  let maxThickness = 0;
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const t = interpolate(upper, x) - interpolate(lower, x);
    if (t > maxThickness) maxThickness = t;
  }

  return {
    getUpper: (x) => interpolate(upper, x),
    getLower: (x) => interpolate(lower, x),
    maxThickness,
  };
}
