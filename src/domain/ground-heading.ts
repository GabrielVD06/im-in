type Vec3 = {
  x: number;
  y: number;
  z: number;
};

const PASTO_DECLINATION = -5;
const MIN_GRAVITY = 0.2;
const MIN_MAGNETIC = 0.001;
const MIN_CROSS = 0.1;
const MIN_LEVEL = 0.45;

function groundHeadingMagnetic(gravity: Vec3, magnetic: Vec3) {
  const gravitySize = Math.hypot(gravity.x, gravity.y, gravity.z);
  const magneticSize = Math.hypot(magnetic.x, magnetic.y, magnetic.z);
  if (gravitySize < MIN_GRAVITY || magneticSize < MIN_MAGNETIC) {
    return null;
  }
  const ax = gravity.x / gravitySize;
  const ay = gravity.y / gravitySize;
  const az = gravity.z / gravitySize;
  const ex = magnetic.x / magneticSize;
  const ey = magnetic.y / magneticSize;
  const ez = magnetic.z / magneticSize;
  let hx = ey * az - ez * ay;
  let hy = ez * ax - ex * az;
  let hz = ex * ay - ey * ax;
  const cross = Math.hypot(hx, hy, hz);
  if (cross < MIN_CROSS) {
    return null;
  }
  hx /= cross;
  hy /= cross;
  hz /= cross;
  const mx = ay * hz - az * hy;
  if (Math.hypot(hx, mx) < MIN_LEVEL) {
    return null;
  }
  const degrees = (Math.atan2(-mx, hx) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function groundHeading(gravity: Vec3, magnetic: Vec3) {
  const magneticNorth = groundHeadingMagnetic(gravity, magnetic);
  if (magneticNorth === null) {
    return null;
  }
  return (magneticNorth + PASTO_DECLINATION + 360) % 360;
}
