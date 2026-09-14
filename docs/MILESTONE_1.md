# Milestone 1 — Flight Vertical Slice

## Goal

Prove the complete core loop with one aircraft, one airport and one runway:

`spawn → taxi → takeoff roll → rotation → liftoff → climb → circuit → approach → touchdown → braking → stop → reset`

The simulator must not fake successful flight with scripted aircraft movement. Lift, acceleration, rotation, descent and touchdown are produced by the simulation state.

## Acceptance criteria

- [x] Fixed-step simulation clock separates physics cadence from render FPS.
- [x] Keyboard flight controls are normalized and survive flight resets.
- [x] Touch/virtual-stick controls remain available through the existing overlay.
- [x] One-airport training configuration is the default startup experience.
- [x] Takeoff requires the aircraft to reach the configured VR speed and generate sufficient aerodynamic lift.
- [x] No artificial vertical impulse is used to force liftoff.
- [x] Landing detects gear-up, excessive bank, tailstrike and excessive sink-rate failures.
- [x] Engine, wind, ground-roll and stall audio react continuously to flight state.
- [x] Existing aircraft control-surface, gear, fan, light and camera rendering remains connected to `FlightState`.
- [x] Production build verification is defined in GitHub Actions.

## Desktop controls

| Action | Keyboard |
|---|---|
| Pitch up/down | `W/S` or `↑/↓` |
| Roll left/right | `A/D` or `←/→` |
| Rudder left/right | `Q/E` |
| Brakes | Hold `B` |
| Landing gear | `G` |
| Flaps extend | `F` |
| Flaps retract | `R` |
| Parking brake | `Space` |
| Cockpit camera | `1` |
| Chase camera | `2` |
| Wing camera | `3` |
| Gear camera | `4` |
| Release controls | `Esc` |

## Manual flight test

1. Open the deployed build.
2. Start with the default A320neo training flight.
3. Keep the aircraft centered on the runway.
4. Apply full throttle.
5. Confirm speed passes VR before the aircraft leaves the runway.
6. Pull gently to rotate; confirm the aircraft climbs because lift exceeds weight.
7. Reduce pitch and configure the aircraft for a stable circuit.
8. Turn back toward the airport and establish an approach.
9. Extend gear and landing flaps.
10. Touch down with low sink rate and wings nearly level.
11. Deploy spoilers/brakes and stop.
12. Reset and repeat.

## Failure tests

- Attempt rotation below VR: aircraft remains on the runway.
- Stall the aircraft: stall state and warning audio activate.
- Land gear-up: flight ends as a crash.
- Touch down with excessive bank: wingtip-strike crash.
- Touch down with excessive pitch: tailstrike crash.
- Touch down with very high sink rate: hard-landing crash.
- Press `B`, release `B`, and verify brakes engage/release.
- Change camera during flight and verify no loss of simulation state.
- Reset while airborne and verify a clean initial state.
- Switch time compression and verify renderer is not recreated.

## Release gate

Milestone 1 is ready for merge when:

1. `bun run build` passes.
2. The deployed build starts without console errors.
3. A fresh user can identify the controls and complete a takeoff.
4. A fresh user can manually return and land without developer intervention.
5. Ten reset/restart cycles do not accumulate visible errors or broken input state.
