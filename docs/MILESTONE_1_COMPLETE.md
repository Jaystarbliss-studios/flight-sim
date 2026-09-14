# Milestone 1 — Vertical Flight Slice

## Target

A browser flight loop that can be completed without developer-console intervention:

**Spawn → prepare → taxi → line up → takeoff → climb → cruise/circuit → approach → land → brake → stop**

## Implemented

- Fixed-step simulation clock with bounded frame work.
- Authoritative flight physics with takeoff, climb, descent, touchdown, braking and crash handling.
- Keyboard flight controls plus existing UI controls.
- Cockpit, chase, wing and gear camera modes with smoothed transitions and dynamic field of view.
- Procedural airport scene with runway threshold markings, centerline, touchdown zones, PAPI, edge lights, taxiway, apron, terminal and tower.
- Procedural terrain/city/mountain depth and weather particles.
- Day, dawn, sunset and night presentation with weather-dependent atmospheric fog.
- External A320 GLB loading with a complete procedural fallback.
- Aircraft presentation for landing gear, flaps, spoilers, elevators, rudder, engine fans and navigation lighting.
- State-driven engine, turbine, wind, runway-roll, stall, touchdown, system-change and GPWS audio.
- Flight HUD/visual overlay and cockpit instrumentation already wired into the application.
- Vercel SPA rewrite and immutable asset-cache configuration.
- Production build verification through GitHub Actions.

## Deliberate scope boundary

Milestone 1 does not claim global Earth streaming, Google Maps, multiplayer, full ATC, FMS, passenger simulation, a complete avionics suite, or a worldwide airport database. Those are later milestones.

## Deployment rule

`main` is the deployment branch. Changes are committed directly to `main`; no feature PR is required for this vertical-slice workflow.
