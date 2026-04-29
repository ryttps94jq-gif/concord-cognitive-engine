'use client';

import { useState, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export interface VehicleSpecs {
  maxSpeedKph:    number;
  torqueNm:       number;
  massKg:         number;
  gears:          number;
  redlineRpm:     number;
  fuelCapacityL:  number;
  chassisStrength: number;  // yield strength in MPa from material DTU
}

export interface VehicleState {
  occupied: boolean;
  vehicleId: string | null;
  specs: VehicleSpecs | null;
  speedKph: number;
  rpm: number;
  gear: number;    // 0 = neutral, -1 = reverse, 1..N = forward gears
  fuel: number;    // 0-100 %
  damage: Record<string, number>;  // part → damage %
  throttle: number;  // 0-1
  brake: number;     // 0-1
  steer: number;     // -1..1
  handbrake: boolean;
}

const DEFAULT_SPECS: VehicleSpecs = {
  maxSpeedKph: 120,
  torqueNm: 250,
  massKg: 1200,
  gears: 5,
  redlineRpm: 7000,
  fuelCapacityL: 50,
  chassisStrength: 300,
};

// ── Hook ─────────────────────────────────────────────────────────────

export function useVehicleState() {
  const [state, setState] = useState<VehicleState>({
    occupied: false,
    vehicleId: null,
    specs: null,
    speedKph: 0,
    rpm: 800,
    gear: 1,
    fuel: 100,
    damage: {},
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const enterVehicle = useCallback((vehicleId: string, specs?: VehicleSpecs) => {
    setState(s => ({
      ...s,
      occupied: true,
      vehicleId,
      specs: specs ?? DEFAULT_SPECS,
      speedKph: 0,
      rpm: 800,
      gear: 1,
      fuel: 100,
      damage: {},
    }));
  }, []);

  const exitVehicle = useCallback(() => {
    setState(s => ({
      ...s,
      occupied: false,
      vehicleId: null,
      speedKph: 0,
      rpm: 800,
      gear: 0,
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
    }));
  }, []);

  const setThrottle = useCallback((v: number) => {
    setState(s => ({ ...s, throttle: Math.max(0, Math.min(1, v)) }));
  }, []);

  const setBrake = useCallback((v: number) => {
    setState(s => ({ ...s, brake: Math.max(0, Math.min(1, v)) }));
  }, []);

  const setSteering = useCallback((v: number) => {
    setState(s => ({ ...s, steer: Math.max(-1, Math.min(1, v)) }));
  }, []);

  const setHandbrake = useCallback((active: boolean) => {
    setState(s => ({ ...s, handbrake: active }));
  }, []);

  const shiftUp = useCallback(() => {
    setState(s => {
      const maxGear = s.specs?.gears ?? 5;
      return { ...s, gear: Math.min(maxGear, s.gear + 1) };
    });
  }, []);

  const shiftDown = useCallback(() => {
    setState(s => ({ ...s, gear: Math.max(-1, s.gear - 1) }));
  }, []);

  // Simplified physics tick — full Rapier physics runs server-side / in ConcordiaScene
  const tick = useCallback((deltaSeconds: number) => {
    setState(s => {
      if (!s.occupied || !s.specs) return s;
      const { specs } = s;

      const fuelBurn = s.throttle * 0.5 * deltaSeconds;
      const newFuel = Math.max(0, s.fuel - fuelBurn);

      // Simple speed model for HUD display
      const accel = newFuel > 0 ? s.throttle * (specs.torqueNm / specs.massKg) * 3.6 : 0;
      const decel = s.brake * 20 + (s.handbrake ? 30 : 0) + s.speedKph * 0.01;
      const newSpeed = Math.max(0, Math.min(specs.maxSpeedKph, s.speedKph + (accel - decel) * deltaSeconds));

      // RPM approximation from speed and gear
      const gearRatio = s.gear <= 0 ? 1 : 1 + (s.gear - 1) * 0.4;
      const rawRpm = 800 + (newSpeed / specs.maxSpeedKph) * (specs.redlineRpm - 800) / gearRatio;
      const newRpm = Math.min(specs.redlineRpm, rawRpm);

      // Chassis stress → damage (material science from DTU)
      const stress = (s.brake > 0.9 && s.speedKph > 80) ? (s.speedKph - 80) * 0.1 : 0;
      const newDamage = { ...s.damage };
      if (stress > 0) {
        const existing = newDamage.chassis ?? 0;
        newDamage.chassis = Math.min(100, existing + stress * deltaSeconds);
      }

      return {
        ...s,
        speedKph: newSpeed,
        rpm: Math.round(newRpm),
        fuel: newFuel,
        damage: newDamage,
      };
    });
  }, []);

  return {
    state,
    enterVehicle,
    exitVehicle,
    setThrottle,
    setBrake,
    setSteering,
    setHandbrake,
    shiftUp,
    shiftDown,
    tick,
  };
}
