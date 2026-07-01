import * as THREE from 'three';

// Jet colormap approximation
export function getHeatmapColor(value) {
  const v = Math.max(0, Math.min(1, value));
  
  // Interpolate between 5 colors: Blue (0), Cyan (0.25), Green (0.5), Yellow (0.75), Red (1.0)
  const colors = [
    new THREE.Color(0x0000ff), // Blue
    new THREE.Color(0x00ffff), // Cyan
    new THREE.Color(0x00ff00), // Green
    new THREE.Color(0xffff00), // Yellow
    new THREE.Color(0xff0000)  // Red
  ];
  
  const numSegments = colors.length - 1;
  const scaled = v * numSegments;
  const idx = Math.floor(scaled);
  const t = scaled - idx;
  
  if (idx >= numSegments) {
    return colors[numSegments].clone();
  }
  
  const c1 = colors[idx];
  const c2 = colors[idx + 1];
  
  return c1.clone().lerp(c2, t);
}
