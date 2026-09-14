import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CameraMode, FlightPlan, FlightState, WeatherType, TimeOfDay } from '../types';

/**
 * Production renderer. Simulation state remains authoritative; this class presents it.
 * Detailed aircraft assets are explicitly opt-in from the hangar.
 */
export class WorldRenderer {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private plan: FlightPlan;
  private cameraMode: CameraMode = 'chase';
  private cameraOrbitYaw = 0;
  private cameraOrbitPitch = 0.14;
  private cameraDistance = 42;
  private cameraTargetPosition = new THREE.Vector3();
  private cameraTargetLook = new THREE.Vector3();
  private cameraInitialized = false;
  private aircraftGroup: THREE.Group;
  private externalAircraftGroup: THREE.Group | null = null;
  private fallbackAircraft: THREE.Group;
  private fanMeshes: THREE.Mesh[] = [];
  private gearGroup!: THREE.Group;
  private flapMeshes: THREE.Mesh[] = [];
  private spoilerMeshes: THREE.Mesh[] = [];
  private elevator!: THREE.Mesh;
  private rudder!: THREE.Mesh;
  private afterburnerMeshes: THREE.Mesh[] = [];
  private afterburnerLights: THREE.PointLight[] = [];
  private vaporConeMesh: THREE.Mesh | null = null;
  private flarePoints: THREE.Points | null = null;
  private activeFlares: { pos: THREE.Vector3; vel: THREE.Vector3; life: number }[] = [];
  private lastFlareTriggerTime = 0;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private skyMesh!: THREE.Mesh;
  private terrainGroup!: THREE.Group;
  private rainParticles!: THREE.Points;
  private runwayLights: THREE.Mesh[] = [];
  private papiLights: THREE.Mesh[] = [];
  private airportGroup!: THREE.Group;
  private isDestroyed = false;
  private elapsed = 0;

  constructor(container: HTMLElement, plan: FlightPlan) {
    this.container = container;
    this.plan = plan;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xb8cce0, 0.000055);
    const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.25, 100000);
    this.camera.position.set(0, 9, -42);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.aircraftGroup = new THREE.Group();
    this.fallbackAircraft = new THREE.Group();
    this.aircraftGroup.add(this.fallbackAircraft);
    this.scene.add(this.aircraftGroup);
    this.setupLighting();
    this.buildSkyAndAtmosphere();
    this.buildAircraft();
    this.loadExternalAircraft();
    this.buildAirport();
    this.buildTerrain();
    this.buildWeather();
    this.applyTimeAndWeather(plan.timeOfDay, plan.weather);
    window.addEventListener('resize', this.onWindowResize);
  }

  public setCameraMode(mode: CameraMode) { this.cameraMode = mode; this.cameraInitialized = false; }
  public setPlan(plan: FlightPlan) {
    const prevAircraftId = this.plan.aircraft.id;
    this.plan = plan;
    this.applyTimeAndWeather(plan.timeOfDay, plan.weather);
    if (prevAircraftId !== plan.aircraft.id) {
      this.rebuildAircraft();
    }
  }

  public rebuildAircraft() {
    while (this.fallbackAircraft.children.length > 0) {
      const child = this.fallbackAircraft.children[0];
      this.fallbackAircraft.remove(child);
    }
    this.fanMeshes = [];
    this.flapMeshes = [];
    this.spoilerMeshes = [];
    this.afterburnerMeshes = [];
    this.afterburnerLights = [];
    this.vaporConeMesh = null;
    this.buildAircraft();
    if (this.plan.aircraft.id !== 'f15') {
      this.loadExternalAircraft();
    } else if (this.externalAircraftGroup) {
      this.aircraftGroup.remove(this.externalAircraftGroup);
      this.externalAircraftGroup = null;
    }
  }
  public rotateCamera(deltaYaw: number, deltaPitch: number) {
    if (this.cameraMode === 'cockpit') return;
    this.cameraOrbitYaw += deltaYaw;
    this.cameraOrbitPitch = THREE.MathUtils.clamp(this.cameraOrbitPitch + deltaPitch, -1.0, 1.0);
  }
  public zoomCamera(deltaDist: number) { this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + deltaDist, 16, 130); }

  private setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xdcecff, 0x30402f, 1.15);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xfff2d7, 2.0);
    this.sunLight.position.set(1800, 4200, 1200);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 20;
    this.sunLight.shadow.camera.far = 9000;
    this.sunLight.shadow.camera.left = -900;
    this.sunLight.shadow.camera.right = 900;
    this.sunLight.shadow.camera.top = 900;
    this.sunLight.shadow.camera.bottom = -900;
    this.scene.add(this.sunLight);
  }

  private buildSkyAndAtmosphere() {
    const skyGeo = new THREE.SphereGeometry(60000, 40, 20);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x79aee0, side: THREE.BackSide, fog: false });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(100000, 100000), new THREE.MeshStandardMaterial({ color: 0x173b55, roughness: 0.18, metalness: 0.72 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 34.5;
    water.receiveShadow = true;
    this.scene.add(water);
  }

  private buildAircraft() {
    if (this.plan.aircraft.isFighter || this.plan.aircraft.id === 'f15') {
      this.buildFighterAircraft();
    } else {
      this.buildCivilianAircraft();
    }
  }

  private buildCivilianAircraft() {
    const spec = this.plan.aircraft;
    const body = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.35, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x20242a, metalness: 0.72, roughness: 0.24 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x075ca8, metalness: 0.48, roughness: 0.3 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x10283b, metalness: 0.25, roughness: 0.08, transmission: 0.55, transparent: true, opacity: 0.9 });
    const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(2.05, Math.max(18, spec.lengthM - 7), 8, 24), body);
    fuselage.rotation.x = Math.PI / 2; fuselage.castShadow = true; this.fallbackAircraft.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.02, 5.6, 24), body);
    nose.rotation.x = Math.PI / 2; nose.position.z = spec.lengthM * 0.47; nose.castShadow = true; this.fallbackAircraft.add(nose);
    const windshield = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), glass);
    windshield.scale.set(1.0, 0.45, 1.3); windshield.position.set(0, 1.05, spec.lengthM * 0.37); this.fallbackAircraft.add(windshield);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM, 0.38, 10.5), body);
    wing.position.set(0, -0.12, 2.0); wing.rotation.y = -0.08; wing.castShadow = true; this.fallbackAircraft.add(wing);
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM * 0.36, 0.26, 4.2), body);
    tailWing.position.set(0, 1.15, -spec.lengthM * 0.43); tailWing.castShadow = true; this.fallbackAircraft.add(tailWing);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 6.3, 4.0), accent);
    fin.position.set(0, 3.15, -spec.lengthM * 0.43); fin.castShadow = true; this.fallbackAircraft.add(fin);
    this.elevator = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM * 0.33, 0.18, 1.15), dark);
    this.elevator.position.set(0, 1.1, -spec.lengthM * 0.53); this.fallbackAircraft.add(this.elevator);
    this.rudder = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.4, 1.0), dark);
    this.rudder.position.set(0, 3.55, -spec.lengthM * 0.5); this.fallbackAircraft.add(this.rudder);
    const engineY = -1.15, engineZ = 1.9;
    for (const x of [-spec.wingSpanM * 0.31, spec.wingSpanM * 0.31]) {
      const engine = new THREE.Group();
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.2, 4.5, 24), body);
      nacelle.rotation.x = Math.PI / 2; nacelle.castShadow = true; engine.add(nacelle);
      const intake = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 10, 24), dark);
      intake.rotation.x = Math.PI / 2; intake.position.z = 2.25; engine.add(intake);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.16, 16), dark);
      fan.rotation.x = Math.PI / 2; fan.position.z = 2.28; engine.add(fan); this.fanMeshes.push(fan);
      engine.position.set(x, engineY, engineZ); this.fallbackAircraft.add(engine);
    }
    this.gearGroup = new THREE.Group();
    const tire = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.92 });
    const strut = new THREE.MeshStandardMaterial({ color: 0x8d9398, metalness: 0.9, roughness: 0.18 });
    const makeWheel = (radius: number, x: number, y: number, z: number) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.38, 18), tire);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(x, y, z); wheel.castShadow = true; this.gearGroup.add(wheel);
    };
    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 10), strut);
    noseStrut.position.set(0, -1.5, spec.lengthM * 0.31); this.gearGroup.add(noseStrut);
    makeWheel(0.46, 0.22, -2.6, spec.lengthM * 0.31); makeWheel(0.46, -0.22, -2.6, spec.lengthM * 0.31);
    for (const x of [-3.25, 3.25]) {
      const mainStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.9, 10), strut);
      mainStrut.position.set(x, -1.65, -1.0); this.gearGroup.add(mainStrut);
      makeWheel(0.64, x - 0.28, -3.0, -0.6); makeWheel(0.64, x + 0.28, -3.0, -1.5);
    }
    this.fallbackAircraft.add(this.gearGroup);
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM * 0.22, 0.18, 1.4), dark);
      flap.position.set(side * spec.wingSpanM * 0.22, -0.22, 1.2); this.flapMeshes.push(flap); this.fallbackAircraft.add(flap);
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM * 0.18, 0.09, 1.0), dark);
      spoiler.position.set(side * spec.wingSpanM * 0.22, 0.18, 1.8); this.spoilerMeshes.push(spoiler); this.fallbackAircraft.add(spoiler);
    }
    const beacon = new THREE.PointLight(0xff2200, 4, 28); beacon.position.set(0, 2.3, 0); this.fallbackAircraft.add(beacon);
    const navL = new THREE.PointLight(0xff1717, 2.5, 18); navL.position.set(spec.wingSpanM * 0.5, 0, -2);
    const navR = new THREE.PointLight(0x22ff66, 2.5, 18); navR.position.set(-spec.wingSpanM * 0.5, 0, -2); this.fallbackAircraft.add(navL, navR);
  }

  private buildFighterAircraft() {
    const spec = this.plan.aircraft;
    const camo = new THREE.MeshStandardMaterial({ color: 0x3d444d, roughness: 0.44, metalness: 0.62 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.36, metalness: 0.8 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xd4a017, metalness: 0.35, roughness: 0.05, transmission: 0.78, transparent: true, opacity: 0.88 });
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.28, metalness: 0.95 });

    // Central blended fuselage
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.5, Math.max(12, spec.lengthM - 6)), camo);
    fuselage.castShadow = true;
    this.fallbackAircraft.add(fuselage);

    // Chined radome nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.25, 5.2, 20), dark);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = spec.lengthM * 0.43;
    nose.castShadow = true;
    this.fallbackAircraft.add(nose);

    // Pitot boom
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), dark);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.z = spec.lengthM * 0.43 + 3.2;
    this.fallbackAircraft.add(pitot);

    // Bubble canopy
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass);
    canopy.scale.set(0.85, 0.65, 2.5);
    canopy.position.set(0, 1.15, spec.lengthM * 0.2);
    this.fallbackAircraft.add(canopy);

    // Swept cropped-delta wings
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM, 0.22, 5.6), camo);
    wing.position.set(0, 0.1, -1.2);
    wing.rotation.y = -0.04;
    wing.castShadow = true;
    this.fallbackAircraft.add(wing);

    // Wingtip missile rails and AIM-9 Sidewinder missiles
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.4), dark);
      rail.position.set(side * (spec.wingSpanM * 0.5), 0.1, -1.2);
      this.fallbackAircraft.add(rail);

      const missile = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 12), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.5, roughness: 0.3 }));
      missile.rotation.x = Math.PI / 2;
      missile.position.set(side * (spec.wingSpanM * 0.5), 0.02, -1.2);
      this.fallbackAircraft.add(missile);

      const missileTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      missileTip.rotation.x = Math.PI / 2;
      missileTip.position.set(side * (spec.wingSpanM * 0.5), 0.02, -1.2 + 1.45);
      this.fallbackAircraft.add(missileTip);
    }

    // Twin vertical stabilizers (outward canted rudders)
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.8, 3.2), camo);
      fin.position.set(side * 1.5, 2.1, -spec.lengthM * 0.36);
      fin.rotation.z = side * -0.06;
      fin.castShadow = true;
      this.fallbackAircraft.add(fin);
    }

    this.rudder = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.8), dark);
    this.rudder.position.set(0, 2.0, -spec.lengthM * 0.44);
    this.fallbackAircraft.add(this.rudder);

    // Horizontal stabilators (elevators)
    this.elevator = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM * 0.44, 0.16, 2.4), dark);
    this.elevator.position.set(0, 0.05, -spec.lengthM * 0.44);
    this.fallbackAircraft.add(this.elevator);

    // Twin afterburning turbofan nozzles
    for (const side of [-1, 1]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.68, 2.2, 20), nozzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(side * 0.95, 0.05, -spec.lengthM * 0.44);
      nozzle.castShadow = true;
      this.fallbackAircraft.add(nozzle);

      // Outer orange flame cone
      const burnerOuter = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 4.8, 16),
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.0, depthWrite: false })
      );
      burnerOuter.rotation.x = -Math.PI / 2;
      burnerOuter.position.set(side * 0.95, 0.05, -spec.lengthM * 0.44 - 3.2);
      this.fallbackAircraft.add(burnerOuter);
      this.afterburnerMeshes.push(burnerOuter);

      // Inner cyan flame core
      const burnerInner = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 3.2, 14),
        new THREE.MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.0, depthWrite: false })
      );
      burnerInner.rotation.x = -Math.PI / 2;
      burnerInner.position.set(side * 0.95, 0.05, -spec.lengthM * 0.44 - 2.5);
      this.fallbackAircraft.add(burnerInner);
      this.afterburnerMeshes.push(burnerInner);

      const burnerLight = new THREE.PointLight(0xff7722, 0, 22);
      burnerLight.position.set(side * 0.95, 0.05, -spec.lengthM * 0.44 - 1.5);
      this.fallbackAircraft.add(burnerLight);
      this.afterburnerLights.push(burnerLight);
    }

    // Supersonic transonic vapor cone
    const coneGeo = new THREE.CylinderGeometry(1.6, 4.4, 3.2, 24, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
    this.vaporConeMesh = new THREE.Mesh(coneGeo, coneMat);
    this.vaporConeMesh.rotation.x = Math.PI / 2;
    this.vaporConeMesh.position.set(0, 0.2, 1.2);
    this.fallbackAircraft.add(this.vaporConeMesh);

    // Fighter Landing Gear
    this.gearGroup = new THREE.Group();
    const tire = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.92 });
    const strut = new THREE.MeshStandardMaterial({ color: 0x8d9398, metalness: 0.9, roughness: 0.18 });
    const makeWheel = (radius: number, x: number, y: number, z: number) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.28, 16), tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      this.gearGroup.add(wheel);
    };
    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 10), strut);
    noseStrut.position.set(0, -1.2, spec.lengthM * 0.26);
    this.gearGroup.add(noseStrut);
    makeWheel(0.38, 0, -2.1, spec.lengthM * 0.26);
    for (const x of [-1.8, 1.8]) {
      const mainStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.3, 10), strut);
      mainStrut.position.set(x, -1.3, -1.2);
      this.gearGroup.add(mainStrut);
      makeWheel(0.48, x, -2.3, -1.2);
    }
    this.fallbackAircraft.add(this.gearGroup);

    // Fighter Flaps & Spoilers
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM * 0.24, 0.12, 1.2), dark);
      flap.position.set(side * (spec.wingSpanM * 0.24), -0.1, -1.6);
      this.flapMeshes.push(flap);
      this.fallbackAircraft.add(flap);
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.wingSpanM * 0.16, 0.08, 0.9), dark);
      spoiler.position.set(side * (spec.wingSpanM * 0.2), 0.14, -0.9);
      this.spoilerMeshes.push(spoiler);
      this.fallbackAircraft.add(spoiler);
    }

    const navL = new THREE.PointLight(0xff1717, 2.5, 18); navL.position.set(spec.wingSpanM * 0.5, 0.1, -1.2);
    const navR = new THREE.PointLight(0x22ff66, 2.5, 18); navR.position.set(-spec.wingSpanM * 0.5, 0.1, -1.2);
    const beacon = new THREE.PointLight(0xff2200, 3, 24); beacon.position.set(0, 1.9, -1.0);
    this.fallbackAircraft.add(navL, navR, beacon);

    this.initFlareParticleSystem();
  }

  private initFlareParticleSystem() {
    if (this.flarePoints) return;
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -9999;
      positions[i * 3 + 2] = 0;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.8;
      colors[i * 3 + 2] = 0.3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flarePoints = new THREE.Points(geo, mat);
    this.scene.add(this.flarePoints);
  }

  private loadExternalAircraft() {
    const url = 'https://raw.githubusercontent.com/amvlab/aircraft-models/main/models/A320_nologo.glb';
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (this.isDestroyed) return;
      const root = gltf.scene;
      root.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const sourceLength = Math.max(size.x, size.y, size.z);
      const targetLength = this.plan.aircraft.lengthM;
      if (sourceLength > 0) root.scale.setScalar(targetLength / sourceLength);

      // Normalize third-party asset axes into the simulator convention:
      // aircraft nose points along +Z before the aircraft body's simulation yaw is applied.
      const dims = [size.x, size.y, size.z];
      const longestAxis = dims.indexOf(Math.max(...dims));
      if (longestAxis === 0) root.rotation.y = Math.PI / 2;
      else if (longestAxis === 1) root.rotation.x = -Math.PI / 2;
      else root.rotation.y = 0;
      root.updateMatrixWorld(true);
      const orientedBox = new THREE.Box3().setFromObject(root);
      const center = orientedBox.getCenter(new THREE.Vector3());
      root.position.sub(center);
      root.position.y += 0.4;

      this.externalAircraftGroup = new THREE.Group();
      this.externalAircraftGroup.add(root);
      this.aircraftGroup.add(this.externalAircraftGroup);
      // Never silently replace the player's selected visual model.
      this.externalAircraftGroup.visible = false;
    }, undefined, () => { /* procedural aircraft remains available */ });
  }

  private buildAirport() {
    this.airportGroup = new THREE.Group();
    const runwayY = 38.04, length = 5500, width = 65;
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x25292e, roughness: 0.86, metalness: 0.08 });
    const marking = new THREE.MeshBasicMaterial({ color: 0xf7f7f2 });
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(width, length), asphalt);
    runway.rotation.x = -Math.PI / 2; runway.position.set(0, runwayY, -length / 2 + 250); runway.receiveShadow = true; this.airportGroup.add(runway);
    const edge = new THREE.MeshBasicMaterial({ color: 0xf4f4ed });
    for (const x of [-width / 2 + 2.3, width / 2 - 2.3]) { const line = new THREE.Mesh(new THREE.PlaneGeometry(1.0, length - 80), edge); line.rotation.x = -Math.PI / 2; line.position.set(x, runwayY + 0.015, -length / 2 + 250); this.airportGroup.add(line); }
    for (let z = 150; z > -length + 330; z -= 45) { const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 27), marking); dash.rotation.x = -Math.PI / 2; dash.position.set(0, runwayY + 0.02, z); this.airportGroup.add(dash); }
    for (let i = -7; i <= 8; i++) { const key = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 34), marking); key.rotation.x = -Math.PI / 2; key.position.set(i * 3.2 - 1.6, runwayY + 0.02, 180); this.airportGroup.add(key); }
    for (const x of [-14, 14]) for (let z = 80; z > -1800; z -= 120) { const td = new THREE.Mesh(new THREE.PlaneGeometry(4, 25), marking); td.rotation.x = -Math.PI / 2; td.position.set(x, runwayY + 0.02, z); this.airportGroup.add(td); }
    const taxiMat = new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 0.9 });
    const taxi = new THREE.Mesh(new THREE.PlaneGeometry(30, 1900), taxiMat); taxi.rotation.x = -Math.PI / 2; taxi.position.set(120, runwayY - 0.01, -450); taxi.receiveShadow = true; this.airportGroup.add(taxi);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(420, 500), taxiMat); apron.rotation.x = -Math.PI / 2; apron.position.set(275, runwayY - 0.015, 100); apron.receiveShadow = true; this.airportGroup.add(apron);
    const terminalMat = new THREE.MeshStandardMaterial({ color: 0xdce4e9, metalness: 0.38, roughness: 0.3 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x2b5c78, metalness: 0.45, roughness: 0.12, transmission: 0.15, transparent: true, opacity: 0.86 });
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(180, 32, 92), terminalMat); terminal.position.set(385, 54, 120); terminal.castShadow = true; this.airportGroup.add(terminal);
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(170, 25), glassMat); facade.rotation.y = -Math.PI / 2; facade.position.set(294, 54, 120); this.airportGroup.add(facade);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 86, 16), terminalMat); tower.position.set(220, 81, 355); tower.castShadow = true; this.airportGroup.add(tower);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 12, 16), glassMat); cab.position.set(220, 128, 355); this.airportGroup.add(cab);
    const taxiMark = new THREE.MeshBasicMaterial({ color: 0xffcf2f });
    for (let z = 420; z > -1350; z -= 24) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 12), taxiMark); m.rotation.x = -Math.PI / 2; m.position.set(120, runwayY + 0.02, z); this.airportGroup.add(m); }
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff8df });
    for (let z = 220; z > -length + 260; z -= 50) for (const x of [-width / 2 - 1, width / 2 + 1]) { const light = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), lightMat); light.position.set(x, runwayY + 0.3, z); this.airportGroup.add(light); this.runwayLights.push(light); }
    this.papiLights = [];
    for (let i = 0; i < 4; i++) { const papi = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.75, 1.15), new THREE.MeshBasicMaterial({ color: 0xffffff })); papi.position.set(40 + i * 4.5, runwayY + 0.55, 60); this.airportGroup.add(papi); this.papiLights.push(papi); }
    this.scene.add(this.airportGroup);
  }

  private buildTerrain() {
    this.terrainGroup = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshStandardMaterial({ color: 0x4c704a, roughness: 0.96, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 37.85; ground.receiveShadow = true; this.terrainGroup.add(ground);
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x707b84, roughness: 0.55, metalness: 0.25 });
    const city = new THREE.InstancedMesh(buildingGeo, buildingMat, 220); const matrix = new THREE.Matrix4(); const pos = new THREE.Vector3(); const quat = new THREE.Quaternion(); const scale = new THREE.Vector3();
    for (let i = 0; i < 220; i++) { const angle = (i / 220) * Math.PI * 2 + Math.random() * 0.08; const radius = 1700 + Math.random() * 3600; pos.set(Math.cos(angle) * radius, 58 + Math.random() * 90, Math.sin(angle) * radius); scale.set(25 + Math.random() * 70, 45 + Math.random() * 180, 25 + Math.random() * 70); quat.identity(); matrix.compose(pos, quat, scale); city.setMatrixAt(i, matrix); }
    city.instanceMatrix.needsUpdate = true; city.castShadow = true; city.receiveShadow = true; this.terrainGroup.add(city);
    for (let i = 0; i < 12; i++) { const mountain = new THREE.Mesh(new THREE.ConeGeometry(1700 + Math.random() * 900, 1500 + Math.random() * 1200, 14), new THREE.MeshStandardMaterial({ color: 0x50634f, roughness: 1 })); const a = (i / 12) * Math.PI * 2; const r = 8500 + Math.random() * 3500; mountain.position.set(Math.cos(a) * r, 700, Math.sin(a) * r); this.terrainGroup.add(mountain); }
    this.scene.add(this.terrainGroup);
  }

  private buildWeather() {
    const count = 22000, positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { positions[i * 3] = (Math.random() - 0.5) * 1600; positions[i * 3 + 1] = Math.random() * 900; positions[i * 3 + 2] = (Math.random() - 0.5) * 1600; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainParticles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xb8d6e8, size: 1.2, transparent: true, opacity: 0.52, depthWrite: false })); this.rainParticles.visible = false; this.scene.add(this.rainParticles);
  }

  public applyTimeAndWeather(timeOfDay: TimeOfDay, weather: WeatherType) {
    const skyMaterial = this.skyMesh.material as THREE.MeshBasicMaterial;
    switch (timeOfDay) {
      case 'dawn': skyMaterial.color.setHex(0xd79a78); this.sunLight.color.setHex(0xffbf91); this.sunLight.intensity = 1.1; this.hemiLight.intensity = 0.72; break;
      case 'sunset': skyMaterial.color.setHex(0xc56b56); this.sunLight.color.setHex(0xffa36d); this.sunLight.intensity = 1.0; this.hemiLight.intensity = 0.62; break;
      case 'night': skyMaterial.color.setHex(0x050b18); this.sunLight.color.setHex(0x6f86b8); this.sunLight.intensity = 0.08; this.hemiLight.intensity = 0.28; break;
      default: skyMaterial.color.setHex(0x79aee0); this.sunLight.color.setHex(0xfff2d7); this.sunLight.intensity = 2.0; this.hemiLight.intensity = 1.15;
    }
    if (this.scene.fog instanceof THREE.FogExp2) { const density = weather === 'fog' ? 0.0008 : weather === 'storm' ? 0.00024 : weather === 'overcast' ? 0.00013 : 0.000055; this.scene.fog.density = density; this.scene.fog.color.copy(skyMaterial.color); }
    const rainy = weather === 'rain' || weather === 'storm'; this.rainParticles.visible = rainy;
    if (weather === 'storm') this.sunLight.intensity *= 0.42;
  }

  public update(state: FlightState, deltaSec: number) {
    if (this.isDestroyed) return;
    this.elapsed += deltaSec;
    this.aircraftGroup.position.set(state.x, state.y, state.z);
    this.aircraftGroup.rotation.order = 'YXZ'; this.aircraftGroup.rotation.y = state.yaw; this.aircraftGroup.rotation.x = state.pitch; this.aircraftGroup.rotation.z = state.roll;
    const fanSpeed = THREE.MathUtils.clamp(state.n1 / 100, 0, 1) * deltaSec * 55; for (const fan of this.fanMeshes) fan.rotation.z += fanSpeed;
    const gear = THREE.MathUtils.clamp(state.gearPosition, 0, 1); if (this.gearGroup) { this.gearGroup.scale.y = 0.25 + gear * 0.75; this.gearGroup.position.y = (1 - gear) * 1.5; }
    const flap = THREE.MathUtils.degToRad(state.flapsAngle || 0); this.flapMeshes.forEach((mesh) => { mesh.rotation.x = flap * 0.72; });
    this.spoilerMeshes.forEach((mesh) => { mesh.rotation.x = -(state.spoilersPosition || 0) * 0.9; });
    this.elevator.rotation.x = state.pitchInput * 0.35; this.rudder.rotation.y = state.yawInput * 0.35;

    // Afterburner animation (dimartarmizi/web-flight-simulator inspired)
    if (this.afterburnerMeshes.length > 0) {
      const isAb = Boolean(state.afterburnerActive);
      const thr = state.throttle;
      for (const mesh of this.afterburnerMeshes) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (isAb) {
          mat.opacity = 0.85 + Math.random() * 0.15;
          mesh.scale.set(1.0 + Math.random() * 0.1, 1.0 + Math.random() * 0.1, 1.0 + Math.random() * 0.3);
        } else if (thr > 0.65) {
          mat.opacity = 0.15;
          mesh.scale.set(0.6, 0.6, 0.45);
        } else {
          mat.opacity = 0.0;
        }
      }
      for (const light of this.afterburnerLights) {
        light.intensity = isAb ? (3.8 + Math.random() * 1.4) : (thr > 0.65 ? 0.6 : 0);
      }
    }

    // Transonic vapor cone shockwave (supersonic transition)
    if (this.vaporConeMesh) {
      const isTransonic = state.mach >= 0.97 && state.mach <= 1.07;
      const mat = this.vaporConeMesh.material as THREE.MeshBasicMaterial;
      const targetOp = isTransonic ? 0.42 + Math.sin(this.elapsed * 24) * 0.08 : 0;
      mat.opacity += (targetOp - mat.opacity) * Math.min(1, deltaSec * 8);
    }

    // Flare countermeasures particle dynamics
    if (state.lastFlareTime && state.lastFlareTime > this.lastFlareTriggerTime) {
      this.lastFlareTriggerTime = state.lastFlareTime;
      const flareOrigin = new THREE.Vector3(state.x, state.y, state.z);
      const fwd = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw)).normalize();
      for (let i = 0; i < 18; i++) {
        const spread = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
        const ejectVel = fwd.clone().multiplyScalar(-35 - Math.random() * 20).add(spread);
        this.activeFlares.push({
          pos: flareOrigin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, -1, (Math.random() - 0.5) * 3)),
          vel: ejectVel,
          life: 1.6 + Math.random() * 0.6,
        });
      }
    }

    if (this.flarePoints && this.activeFlares.length > 0) {
      const posAttr = this.flarePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < this.activeFlares.length; i++) {
        const f = this.activeFlares[i];
        f.pos.addScaledVector(f.vel, deltaSec);
        f.vel.y -= 9.8 * deltaSec * 0.4;
        f.vel.multiplyScalar(0.96);
        f.life -= deltaSec;
        arr[i * 3] = f.pos.x;
        arr[i * 3 + 1] = f.pos.y;
        arr[i * 3 + 2] = f.pos.z;
      }
      for (let i = this.activeFlares.length; i < 120; i++) {
        arr[i * 3 + 1] = -9999;
      }
      this.activeFlares = this.activeFlares.filter(f => f.life > 0);
      posAttr.needsUpdate = true;
    }

    if (this.rainParticles.visible) { this.rainParticles.position.set(state.x, state.y, state.z); const attr = this.rainParticles.geometry.getAttribute('position') as THREE.BufferAttribute; const arr = attr.array as Float32Array; for (let i = 1; i < arr.length; i += 3) { arr[i] -= deltaSec * 260; if (arr[i] < -20) arr[i] += 900; } attr.needsUpdate = true; }
    this.updateCamera(state, deltaSec);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(state: FlightState, deltaSec: number) {
    const aircraftPos = new THREE.Vector3(state.x, state.y, state.z);
    const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    if (!this.cameraInitialized) { this.camera.position.copy(aircraftPos).add(new THREE.Vector3(0, 7, -this.cameraDistance)); this.cameraInitialized = true; }
    let desired = new THREE.Vector3();
    if (this.cameraMode === 'cockpit') { desired.copy(aircraftPos).add(up.clone().multiplyScalar(2.2)); this.cameraTargetLook.copy(aircraftPos).add(forward.multiplyScalar(120)).add(up.clone().multiplyScalar(2)); }
    else { desired.copy(aircraftPos).add(up.clone().multiplyScalar(5)).add(forward.clone().multiplyScalar(-this.cameraDistance)); desired.applyAxisAngle(up, this.cameraOrbitYaw); desired.y += Math.sin(this.cameraOrbitPitch) * this.cameraDistance * 0.28; this.cameraTargetLook.copy(aircraftPos).add(up.clone().multiplyScalar(2)); }
    const smooth = 1 - Math.exp(-deltaSec * 5.5); this.camera.position.lerp(desired, smooth); this.cameraTargetPosition.lerp(aircraftPos, smooth); this.camera.lookAt(this.cameraTargetLook);
  }

  private onWindowResize = () => { if (this.isDestroyed) return; const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); };
  public destroy() { this.isDestroyed = true; window.removeEventListener('resize', this.onWindowResize); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
