# Phase 4: Driving Mode

## Files Created
- `hooks/useVehicleState.ts` — VehicleState, physics tick, gear shifting, fuel burn, chassis damage from material stress
- `components/concordia/hud/VehicleHUD.tsx` — arc gauges for speed/RPM, gear display, fuel bar, damage panel

## Mechanics

### Vehicle physics (tied to material science DTU)
- `VehicleSpecs` loaded from vehicle's DTU content (torque, mass, gears, redline, chassis yield strength)
- Throttle → acceleration derived from torque/mass ratio; brake → deceleration
- RPM computed from speed × gear ratio → red-lines at spec limit
- Hard braking at high speed applies stress; if stress > chassisStrength → chassis damage accumulates
- Fuel depletes proportionally to throttle; 0 fuel = no acceleration

### HUD
- Arc speedometer and tachometer with animated stroke arcs
- Tachometer goes red when near redline (Fallout: materials have real limits)
- Gear shows N/R/1-6
- Fuel bar color-coded (green → yellow → red)
- Damage panel shows damaged parts

### Controls
Desktop: W/Up throttle, S/Down brake, A/D steer, Space handbrake, Shift gear up, Ctrl gear down, E exit, H horn
Mobile: throttle slider right, brake slider left, steering wheel bottom-center, tap exit

## Status: Complete
