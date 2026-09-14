import * as THREE from 'three';
import { CameraMode, FlightPlan, FlightState, WeatherType, TimeOfDay } from '../types';

export class WorldRenderer {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private plan: FlightPlan;

  // Camera settings
  private cameraMode: CameraMode = 'chase';
  private cameraOrbitYaw: number = 0;
  private cameraOrbitPitch: number = 0.2;
  private cameraDistance: number = 42;

  // Aircraft components
  private aircraftGroup: THREE.Group;
  private fuselageMesh!: THREE.Mesh;
  private leftAileron!: THREE.Mesh;
  private rightAileron!: THREE.Mesh;
  private leftFlap!: THREE.Mesh;
  private rightFlap!: THREE.Mesh;
  private leftSpoiler!: THREE.Mesh;
  private rightSpoiler!: THREE.Mesh;
  private elevatorMesh!: THREE.Mesh;
  private rudderMesh!: THREE.Mesh;
  private noseGearGroup!: THREE.Group;
  private mainGearGroup!: THREE.Group;
  private leftFanMesh!: THREE.Mesh;
  private rightFanMesh!: THREE.Mesh;
  private yokeMesh!: THREE.Group;
  private cockpitGroup!: THREE.Group;

  // Lights on aircraft
  private navRedLight!: THREE.PointLight;
  private navGreenLight!: THREE.PointLight;
  private strobeLight!: THREE.PointLight;
  private beaconLight!: THREE.PointLight;
  private landingLight1!: THREE.SpotLight;
  private landingLight2!: THREE.SpotLight;
  private strobeTimer: number = 0;
  private beaconTimer: number = 0;

  // Environment elements
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private skyMesh!: THREE.Mesh;
  private waterMesh!: THREE.Mesh;
  private terrainGroup!: THREE.Group;
  private papiLights: THREE.Mesh[] = [];
  private rainParticles!: THREE.Points;
  private pushbackTug!: THREE.Group;
  private jetway!: THREE.Group;

  // Rendering performance
  private isDestroyed: boolean = false;

  constructor(container: HTMLElement, plan: FlightPlan) {
    this.container = container;
    this.plan = plan;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xbfd7ea, 0.00012);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.5, 80000);
    this.camera.position.set(0, 10, -40);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 3. Aircraft Group
    this.aircraftGroup = new THREE.Group();
    this.scene.add(this.aircraftGroup);

    // 4. Build Environment & Aircraft
    this.setupLighting();
    this.buildSkyAndAtmosphere();
    this.buildAircraft();
    this.buildAirport();
    this.buildCityAndTerrain();
    this.buildCloudsAndWeather();

    this.applyTimeAndWeather(plan.timeOfDay, plan.weather);

    // Resize listener
    window.addEventListener('resize', this.onWindowResize);
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
  }

  public setPlan(plan: FlightPlan) {
    this.plan = plan;
    this.applyTimeAndWeather(plan.timeOfDay, plan.weather);
  }

  public rotateCamera(deltaYaw: number, deltaPitch: number) {
    this.cameraOrbitYaw += deltaYaw;
    this.cameraOrbitPitch = Math.max(-1.1, Math.min(1.1, this.cameraOrbitPitch + deltaPitch));
  }

  public zoomCamera(deltaDist: number) {
    this.cameraDistance = Math.max(15, Math.min(120, this.cameraDistance + deltaDist));
  }

  private setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.8);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8ee, 1.6);
    this.sunLight.position.set(2000, 3000, 1500);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 10000;
    const d = 250;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
  }

  private buildSkyAndAtmosphere() {
    const skyGeo = new THREE.SphereGeometry(60000, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x82b4ea,
      side: THREE.BackSide,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    // Water plane
    const waterGeo = new THREE.PlaneGeometry(80000, 80000);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a3d54,
      roughness: 0.15,
      metalness: 0.85,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -1;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  private buildAircraft() {
    const spec = this.plan.aircraft;
    const aircraftMat = new THREE.MeshStandardMaterial({
      color: 0xf3f5f8,
      metalness: 0.45,
      roughness: 0.35,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      metalness: 0.85,
      roughness: 0.25,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      metalness: 0.9,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
    });
    const airlineBlueMat = new THREE.MeshStandardMaterial({
      color: 0x0055aa,
      roughness: 0.3,
      metalness: 0.5,
    });

    // 1. Fuselage
    const fuseGeo = new THREE.CylinderGeometry(1.95, 1.95, spec.lengthM * 0.75, 24);
    fuseGeo.rotateX(Math.PI / 2);
    this.fuselageMesh = new THREE.Mesh(fuseGeo, aircraftMat);
    this.fuselageMesh.castShadow = true;
    this.aircraftGroup.add(this.fuselageMesh);

    // Streamlined Nose cone
    const noseGeo = new THREE.ConeGeometry(1.95, spec.lengthM * 0.22, 24);
    noseGeo.rotateX(Math.PI / 2);
    const noseMesh = new THREE.Mesh(noseGeo, aircraftMat);
    noseMesh.position.z = spec.lengthM * 0.48;
    this.aircraftGroup.add(noseMesh);

    // Cockpit windshield
    const windGeo = new THREE.BoxGeometry(1.8, 0.7, 1.2);
    const windMesh = new THREE.Mesh(windGeo, glassMat);
    windMesh.position.set(0, 0.9, spec.lengthM * 0.38);
    windMesh.rotation.x = 0.35;
    this.aircraftGroup.add(windMesh);

    // Tailcone
    const tailConeGeo = new THREE.ConeGeometry(1.95, spec.lengthM * 0.3, 24);
    tailConeGeo.rotateX(-Math.PI / 2);
    const tailConeMesh = new THREE.Mesh(tailConeGeo, aircraftMat);
    tailConeMesh.position.z = -spec.lengthM * 0.52;
    this.aircraftGroup.add(tailConeMesh);

    // 2. Swept Wings
    const halfSpan = spec.wingSpanM * 0.5;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(halfSpan, -8);
    wingShape.lineTo(halfSpan, -9.8);
    wingShape.lineTo(0, -6.5);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.45, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(-Math.PI / 2);

    // Left Wing
    const leftWing = new THREE.Mesh(wingGeo, aircraftMat);
    leftWing.position.set(1.4, -0.2, 3.5);
    leftWing.castShadow = true;
    this.aircraftGroup.add(leftWing);

    // Winglet Left
    const wingletGeo = new THREE.BoxGeometry(0.15, 2.2, 1.2);
    const leftWinglet = new THREE.Mesh(wingletGeo, airlineBlueMat);
    leftWinglet.position.set(1.4 + halfSpan, 0.9, 3.5 - 9);
    leftWinglet.rotation.z = 0.15;
    this.aircraftGroup.add(leftWinglet);

    // Right Wing (mirrored)
    const rightWingGeo = wingGeo.clone();
    rightWingGeo.scale(-1, 1, 1);
    const rightWing = new THREE.Mesh(rightWingGeo, aircraftMat);
    rightWing.position.set(-1.4, -0.2, 3.5);
    rightWing.castShadow = true;
    this.aircraftGroup.add(rightWing);

    // Winglet Right
    const rightWinglet = new THREE.Mesh(wingletGeo, airlineBlueMat);
    rightWinglet.position.set(-(1.4 + halfSpan), 0.9, 3.5 - 9);
    rightWinglet.rotation.z = -0.15;
    this.aircraftGroup.add(rightWinglet);

    // 3. Control Surfaces: Flaps, Ailerons, Spoilers
    const flapGeo = new THREE.BoxGeometry(halfSpan * 0.45, 0.18, 1.4);
    const aileronGeo = new THREE.BoxGeometry(halfSpan * 0.35, 0.15, 1.1);
    const spoilerGeo = new THREE.BoxGeometry(halfSpan * 0.4, 0.08, 0.9);

    // Left Flap
    this.leftFlap = new THREE.Mesh(flapGeo, darkMetalMat);
    this.leftFlap.position.set(1.4 + halfSpan * 0.28, -0.2, 3.5 - 6.2);
    this.aircraftGroup.add(this.leftFlap);

    // Right Flap
    this.rightFlap = new THREE.Mesh(flapGeo, darkMetalMat);
    this.rightFlap.position.set(-(1.4 + halfSpan * 0.28), -0.2, 3.5 - 6.2);
    this.aircraftGroup.add(this.rightFlap);

    // Left Aileron
    this.leftAileron = new THREE.Mesh(aileronGeo, darkMetalMat);
    this.leftAileron.position.set(1.4 + halfSpan * 0.72, -0.18, 3.5 - 8.6);
    this.aircraftGroup.add(this.leftAileron);

    // Right Aileron
    this.rightAileron = new THREE.Mesh(aileronGeo, darkMetalMat);
    this.rightAileron.position.set(-(1.4 + halfSpan * 0.72), -0.18, 3.5 - 8.6);
    this.aircraftGroup.add(this.rightAileron);

    // Left Spoiler
    this.leftSpoiler = new THREE.Mesh(spoilerGeo, darkMetalMat);
    this.leftSpoiler.position.set(1.4 + halfSpan * 0.3, 0.12, 3.5 - 5.5);
    this.aircraftGroup.add(this.leftSpoiler);

    // Right Spoiler
    this.rightSpoiler = new THREE.Mesh(spoilerGeo, darkMetalMat);
    this.rightSpoiler.position.set(-(1.4 + halfSpan * 0.3), 0.12, 3.5 - 5.5);
    this.aircraftGroup.add(this.rightSpoiler);

    // 4. Turbofan Engines (Left & Right)
    const nacelleGeo = new THREE.CylinderGeometry(1.2, 1.25, 4.2, 24);
    nacelleGeo.rotateX(Math.PI / 2);
    const pylonGeo = new THREE.BoxGeometry(0.3, 1.1, 2.5);

    // Left Engine
    const leftEngineGroup = new THREE.Group();
    const leftNacelle = new THREE.Mesh(nacelleGeo, aircraftMat);
    leftNacelle.castShadow = true;
    const leftPylon = new THREE.Mesh(pylonGeo, darkMetalMat);
    leftPylon.position.set(0, 1.0, 0.3);
    leftEngineGroup.add(leftNacelle, leftPylon);

    // Spinning Fan blades
    const fanGeo = new THREE.ConeGeometry(0.85, 0.4, 16);
    fanGeo.rotateX(Math.PI / 2);
    this.leftFanMesh = new THREE.Mesh(fanGeo, darkMetalMat);
    this.leftFanMesh.position.z = 2.0;
    leftEngineGroup.add(this.leftFanMesh);

    leftEngineGroup.position.set(6.5, -1.2, 1.8);
    this.aircraftGroup.add(leftEngineGroup);

    // Right Engine
    const rightEngineGroup = leftEngineGroup.clone();
    rightEngineGroup.position.set(-6.5, -1.2, 1.8);
    this.rightFanMesh = rightEngineGroup.children[2] as THREE.Mesh;
    this.aircraftGroup.add(rightEngineGroup);

    // 5. Tail Empennage: Vertical Fin, Rudder, Horizontal Stabilizers, Elevators
    const vFinGeo = new THREE.BoxGeometry(0.35, 6.2, 3.8);
    vFinGeo.translate(0, 3.1, -spec.lengthM * 0.46);
    const vFinMesh = new THREE.Mesh(vFinGeo, airlineBlueMat);
    vFinMesh.castShadow = true;
    this.aircraftGroup.add(vFinMesh);

    // Rudder
    const rudderGeo = new THREE.BoxGeometry(0.3, 5.8, 1.2);
    this.rudderMesh = new THREE.Mesh(rudderGeo, darkMetalMat);
    this.rudderMesh.position.set(0, 3.8, -spec.lengthM * 0.52);
    this.aircraftGroup.add(this.rudderMesh);

    // Horizontal Stabilizers & Elevators
    const hStabGeo = new THREE.BoxGeometry(11.5, 0.25, 3.2);
    const hStabMesh = new THREE.Mesh(hStabGeo, aircraftMat);
    hStabMesh.position.set(0, 1.2, -spec.lengthM * 0.48);
    hStabMesh.castShadow = true;
    this.aircraftGroup.add(hStabMesh);

    const elevGeo = new THREE.BoxGeometry(11.2, 0.2, 1.0);
    this.elevatorMesh = new THREE.Mesh(elevGeo, darkMetalMat);
    this.elevatorMesh.position.set(0, 1.2, -spec.lengthM * 0.54);
    this.aircraftGroup.add(this.elevatorMesh);

    // 6. Retractable Tricycle Landing Gear
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.9, roughness: 0.2 });

    // Nose Gear
    this.noseGearGroup = new THREE.Group();
    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 12), strutMat);
    noseStrut.position.y = -1.4;
    const noseWheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.28, 16);
    noseWheelGeo.rotateZ(Math.PI / 2);
    const noseWheelL = new THREE.Mesh(noseWheelGeo, tireMat);
    noseWheelL.position.set(0.22, -2.7, 0);
    const noseWheelR = new THREE.Mesh(noseWheelGeo, tireMat);
    noseWheelR.position.set(-0.22, -2.7, 0);
    this.noseGearGroup.add(noseStrut, noseWheelL, noseWheelR);
    this.noseGearGroup.position.set(0, -0.4, spec.lengthM * 0.38);
    this.aircraftGroup.add(this.noseGearGroup);

    // Main Gear (Left and Right)
    this.mainGearGroup = new THREE.Group();
    const mainStrutL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 12), strutMat);
    mainStrutL.position.set(3.4, -1.6, -1.2);
    const mainWheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.4, 16);
    mainWheelGeo.rotateZ(Math.PI / 2);
    const mainWheelL1 = new THREE.Mesh(mainWheelGeo, tireMat);
    mainWheelL1.position.set(3.4, -3.1, -0.7);
    const mainWheelL2 = new THREE.Mesh(mainWheelGeo, tireMat);
    mainWheelL2.position.set(3.4, -3.1, -1.7);

    const mainStrutR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 12), strutMat);
    mainStrutR.position.set(-3.4, -1.6, -1.2);
    const mainWheelR1 = new THREE.Mesh(mainWheelGeo, tireMat);
    mainWheelR1.position.set(-3.4, -3.1, -0.7);
    const mainWheelR2 = new THREE.Mesh(mainWheelGeo, tireMat);
    mainWheelR2.position.set(-3.4, -3.1, -1.7);

    this.mainGearGroup.add(mainStrutL, mainWheelL1, mainWheelL2, mainStrutR, mainWheelR1, mainWheelR2);
    this.aircraftGroup.add(this.mainGearGroup);

    // 7. Navigation, Beacon & Strobe Lights
    this.navRedLight = new THREE.PointLight(0xff0000, 3, 15);
    this.navRedLight.position.set(1.4 + halfSpan, 0.1, 3.5 - 9);
    this.aircraftGroup.add(this.navRedLight);

    this.navGreenLight = new THREE.PointLight(0x00ff00, 3, 15);
    this.navGreenLight.position.set(-(1.4 + halfSpan), 0.1, 3.5 - 9);
    this.aircraftGroup.add(this.navGreenLight);

    this.strobeLight = new THREE.PointLight(0xffffff, 0, 40);
    this.strobeLight.position.set(0, 0.2, -spec.lengthM * 0.58);
    this.aircraftGroup.add(this.strobeLight);

    this.beaconLight = new THREE.PointLight(0xff2200, 0, 30);
    this.beaconLight.position.set(0, 2.2, 0);
    this.aircraftGroup.add(this.beaconLight);

    // Landing Headlights
    this.landingLight1 = new THREE.SpotLight(0xfffaed, 8, 350, Math.PI / 9, 0.4, 1.2);
    this.landingLight1.position.set(2.8, -0.4, 2.5);
    this.landingLight1.target.position.set(2.8, -2.5, 80);
    this.aircraftGroup.add(this.landingLight1);
    this.aircraftGroup.add(this.landingLight1.target);

    this.landingLight2 = new THREE.SpotLight(0xfffaed, 8, 350, Math.PI / 9, 0.4, 1.2);
    this.landingLight2.position.set(-2.8, -0.4, 2.5);
    this.landingLight2.target.position.set(-2.8, -2.5, 80);
    this.aircraftGroup.add(this.landingLight2);
    this.aircraftGroup.add(this.landingLight2.target);

    // 8. Interactive Cockpit & Flight Controls
    this.cockpitGroup = new THREE.Group();
    const panelGeo = new THREE.BoxGeometry(2.4, 0.9, 0.6);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.7 });
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    panelMesh.position.set(0, 0.45, 1.8);
    panelMesh.rotation.x = -0.2;
    this.cockpitGroup.add(panelMesh);

    // Dual Flight Yoke
    this.yokeMesh = new THREE.Group();
    const yokeColGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 12);
    const yokeCol = new THREE.Mesh(yokeColGeo, darkMetalMat);
    yokeCol.position.y = 0.4;
    const yokeHandleGeo = new THREE.TorusGeometry(0.22, 0.035, 8, 18, Math.PI);
    yokeHandleGeo.rotateZ(Math.PI);
    const yokeHandle = new THREE.Mesh(yokeHandleGeo, darkMetalMat);
    yokeHandle.position.y = 0.8;
    this.yokeMesh.add(yokeCol, yokeHandle);
    this.yokeMesh.position.set(-0.55, 0.1, 1.2);
    this.cockpitGroup.add(this.yokeMesh);

    this.cockpitGroup.position.set(0, 0.55, spec.lengthM * 0.35);
    this.aircraftGroup.add(this.cockpitGroup);
  }

  private buildAirport() {
    // 1. Ultra-Long Runway 24L (5500 meters to ensure ample distance to reach 136+ knots and takeoff safely)
    const rwyLength = 5500;
    const rwyWidth = 65;
    const rwyGeo = new THREE.PlaneGeometry(rwyWidth, rwyLength);
    const rwyMat = new THREE.MeshStandardMaterial({
      color: 0x24272c,
      roughness: 0.88,
      metalness: 0.12,
    });
    const runwayMesh = new THREE.Mesh(rwyGeo, rwyMat);
    runwayMesh.rotation.x = -Math.PI / 2;
    runwayMesh.position.set(0, 38.05, -rwyLength / 2 + 250);
    runwayMesh.receiveShadow = true;
    this.scene.add(runwayMesh);

    // 2. Runway Markings (Centerline, Threshold Piano Keys)
    const whiteMarkMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });

    // Threshold piano keys (16 stripes at start)
    for (let i = -7; i <= 8; i++) {
      const stripeGeo = new THREE.PlaneGeometry(2.0, 35);
      const stripe = new THREE.Mesh(stripeGeo, whiteMarkMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i * 3.2 - 1.6, 38.08, 180);
      this.scene.add(stripe);
    }

    // Centerline dashed lines along the entire 5500m runway
    for (let z = 140; z > -rwyLength + 320; z -= 45) {
      const dashGeo = new THREE.PlaneGeometry(1.6, 28);
      const dash = new THREE.Mesh(dashGeo, whiteMarkMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 38.08, z);
      this.scene.add(dash);
    }

    // Touchdown zone marks
    for (let t = 60; t > -1800; t -= 120) {
      const tdzL = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 25), whiteMarkMat);
      tdzL.rotation.x = -Math.PI / 2;
      tdzL.position.set(14, 38.08, t);
      const tdzR = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 25), whiteMarkMat);
      tdzR.rotation.x = -Math.PI / 2;
      tdzR.position.set(-14, 38.08, t);
      this.scene.add(tdzL, tdzR);
    }

    // 3. 4-Light PAPI (Precision Approach Path Indicator)
    this.papiLights = [];
    for (let i = 0; i < 4; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.8, 1.2),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      box.position.set(40 + i * 4.5, 38.8, 60);
      this.scene.add(box);
      this.papiLights.push(box);
    }

    // 4. Runway Edge & Centerline Lights spanning full runway
    const lightMatWhite = new THREE.MeshBasicMaterial({ color: 0xfffaed });
    for (let z = 220; z > -rwyLength + 260; z -= 50) {
      const lightL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lightMatWhite);
      lightL.position.set(rwyWidth / 2 + 1, 38.3, z);
      const lightR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lightMatWhite);
      lightR.position.set(-rwyWidth / 2 - 1, 38.3, z);
      this.scene.add(lightL, lightR);
    }

    // 5. Taxiways & Airport Apron
    const taxiGeo = new THREE.PlaneGeometry(28, 1800);
    const taxiMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.9 });
    const taxiMesh = new THREE.Mesh(taxiGeo, taxiMat);
    taxiMesh.rotation.x = -Math.PI / 2;
    taxiMesh.position.set(120, 38.04, -400);
    taxiMesh.receiveShadow = true;
    this.scene.add(taxiMesh);

    // Terminal Apron
    const apronGeo = new THREE.PlaneGeometry(350, 450);
    const apron = new THREE.Mesh(apronGeo, taxiMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(280, 38.03, 100);
    apron.receiveShadow = true;
    this.scene.add(apron);

    // 6. Modern Airport Terminal Architecture
    const termMat = new THREE.MeshStandardMaterial({ color: 0xdddfec, metalness: 0.4, roughness: 0.3 });
    const termGlass = new THREE.MeshPhysicalMaterial({ color: 0x224466, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.75 });
    const terminalBuilding = new THREE.Mesh(new THREE.BoxGeometry(180, 32, 90), termMat);
    terminalBuilding.position.set(380, 54, 120);
    terminalBuilding.castShadow = true;
    this.scene.add(terminalBuilding);

    const termFacade = new THREE.Mesh(new THREE.PlaneGeometry(175, 26), termGlass);
    termFacade.position.set(289, 54, 120);
    termFacade.rotation.y = -Math.PI / 2;
    this.scene.add(termFacade);

    // Control Tower
    const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 85, 16), termMat);
    towerBase.position.set(220, 80, 360);
    towerBase.castShadow = true;
    const towerCab = new THREE.Mesh(new THREE.CylinderGeometry(14, 10, 16, 16), termGlass);
    towerCab.position.set(220, 126, 360);
    this.scene.add(towerBase, towerCab);

    // Animated Jetway
    this.jetway = new THREE.Group();
    const jetArm = new THREE.Mesh(new THREE.BoxGeometry(22, 4.2, 4.2), termMat);
    jetArm.position.set(11, 41, 0);
    this.jetway.add(jetArm);
    this.jetway.position.set(285, 0, 50);
    this.scene.add(this.jetway);

    // Pushback Tug
    this.pushbackTug = new THREE.Group();
    const tugBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.6, 7.5), new THREE.MeshStandardMaterial({ color: 0xee9900, roughness: 0.5 }));
    tugBody.position.set(0, 39, 18);
    this.pushbackTug.add(tugBody);
    this.scene.add(this.pushbackTug);
  }

  private buildCityAndTerrain() {
    this.terrainGroup = new THREE.Group();
    const groundGeo = new THREE.PlaneGeometry(60000, 60000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a6b47,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 37.9, 0);
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // City Skyscrapers Grid (InstancedMesh for maximum 60fps performance)
    const buildingCount = 180;
    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    const bldgMat = new THREE.MeshStandardMaterial({
      color: 0x778899,
      roughness: 0.4,
      metalness: 0.6,
    });
    const instancedBuildings = new THREE.InstancedMesh(bldgGeo, bldgMat, buildingCount);
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < buildingCount; i++) {
      const angle = (i / buildingCount) * Math.PI * 2;
      const radius = 2200 + Math.random() * 4500;
      pos.set(
        Math.cos(angle) * radius + (Math.random() - 0.5) * 800,
        38 + (Math.random() * 120 + 40) / 2,
        Math.sin(angle) * radius - 2000 + (Math.random() - 0.5) * 800
      );
      scale.set(40 + Math.random() * 50, Math.random() * 180 + 50, 40 + Math.random() * 50);
      rot.set(0, (Math.random() * Math.PI) / 2, 0);
      quat.setFromEuler(rot);
      matrix.compose(pos, quat, scale);
      instancedBuildings.setMatrixAt(i, matrix);
    }
    instancedBuildings.castShadow = true;
    instancedBuildings.receiveShadow = true;
    this.terrainGroup.add(instancedBuildings);

    // Mountains in background
    for (let m = 0; m < 12; m++) {
      const mRadius = 9000 + m * 1400;
      const mAngle = (m / 12) * Math.PI + 0.5;
      const mountainGeo = new THREE.ConeGeometry(1800 + Math.random() * 800, 1200 + Math.random() * 1600, 16);
      const mountainMat = new THREE.MeshStandardMaterial({ color: 0x5a6058, roughness: 0.9 });
      const mountain = new THREE.Mesh(mountainGeo, mountainMat);
      mountain.position.set(Math.cos(mAngle) * mRadius, 600, Math.sin(mAngle) * mRadius - 15000);
      this.terrainGroup.add(mountain);
    }

    this.scene.add(this.terrainGroup);
  }

  private buildCloudsAndWeather() {
    // Rain Particles
    const rainCount = 4000;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 1200;
      positions[i + 1] = Math.random() * 800;
      positions[i + 2] = (Math.random() - 0.5) * 1200;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x99bbdd,
      size: 1.2,
      transparent: true,
      opacity: 0.6,
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  public applyTimeAndWeather(timeOfDay: TimeOfDay, weather: WeatherType) {
    // 1. Time of Day
    switch (timeOfDay) {
      case 'dawn':
        this.sunLight.position.set(3000, 800, 1500);
        this.sunLight.color.setHex(0xffaa77);
        this.sunLight.intensity = 1.1;
        this.hemiLight.color.setHex(0xffccaa);
        this.hemiLight.groundColor.setHex(0x332222);
        (this.skyMesh.material as THREE.MeshBasicMaterial).color.setHex(0xb27766);
        this.scene.fog?.color.setHex(0xb27766);
        break;
      case 'sunset':
        this.sunLight.position.set(-3000, 600, 1500);
        this.sunLight.color.setHex(0xff7744);
        this.sunLight.intensity = 1.2;
        this.hemiLight.color.setHex(0xff9977);
        (this.skyMesh.material as THREE.MeshBasicMaterial).color.setHex(0xc46644);
        this.scene.fog?.color.setHex(0xc46644);
        break;
      case 'night':
        this.sunLight.position.set(0, -2000, 0);
        this.sunLight.intensity = 0.05;
        this.hemiLight.color.setHex(0x223355);
        this.hemiLight.groundColor.setHex(0x050510);
        this.hemiLight.intensity = 0.35;
        (this.skyMesh.material as THREE.MeshBasicMaterial).color.setHex(0x060814);
        this.scene.fog?.color.setHex(0x060814);
        break;
      case 'day':
      default:
        this.sunLight.position.set(2000, 4500, 1500);
        this.sunLight.color.setHex(0xfffbee);
        this.sunLight.intensity = 1.7;
        this.hemiLight.color.setHex(0xffffff);
        this.hemiLight.groundColor.setHex(0x445566);
        this.hemiLight.intensity = 0.9;
        (this.skyMesh.material as THREE.MeshBasicMaterial).color.setHex(0x7fb2ea);
        this.scene.fog?.color.setHex(0xbfd7ea);
        break;
    }

    // 2. Weather
    const isRain = weather === 'rain' || weather === 'storm';
    this.rainParticles.visible = isRain;

    if (weather === 'fog') {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.0008;
      }
    } else if (weather === 'storm') {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.00035;
      }
      this.sunLight.intensity *= 0.4;
    } else {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.00012;
      }
    }
  }

  public update(state: FlightState, deltaSec: number) {
    if (this.isDestroyed) return;

    // 1. Sync Aircraft Position and Euler Angles
    this.aircraftGroup.position.set(state.x, state.y, state.z);
    this.aircraftGroup.rotation.order = 'YXZ';
    this.aircraftGroup.rotation.y = state.yaw;
    this.aircraftGroup.rotation.x = state.pitch;
    this.aircraftGroup.rotation.z = state.roll;

    // 2. Animate Control Surfaces
    // Ailerons
    this.leftAileron.rotation.x = -state.rollInput * 0.35;
    this.rightAileron.rotation.x = state.rollInput * 0.35;

    // Elevators
    this.elevatorMesh.rotation.x = state.pitchInput * 0.4;

    // Rudder
    this.rudderMesh.rotation.y = state.yawInput * 0.35;

    // Flaps deployment
    const flapRad = (state.flapsAngle * Math.PI) / 180;
    this.leftFlap.rotation.x = flapRad * 0.6;
    this.leftFlap.position.y = -0.2 - Math.sin(flapRad) * 0.4;
    this.rightFlap.rotation.x = flapRad * 0.6;
    this.rightFlap.position.y = -0.2 - Math.sin(flapRad) * 0.4;

    // Spoilers
    this.leftSpoiler.rotation.x = -state.spoilersPosition * 0.75;
    this.rightSpoiler.rotation.x = -state.spoilersPosition * 0.75;

    // Spinning Turbofan Blades
    const fanSpeed = (state.n1 / 100) * 45 * deltaSec;
    this.leftFanMesh.rotation.z += fanSpeed;
    this.rightFanMesh.rotation.z += fanSpeed;

    // Retractable Landing Gear
    const gearFraction = state.gearPosition; // 1 = down, 0 = up
    this.noseGearGroup.scale.set(1, gearFraction, 1);
    this.noseGearGroup.position.y = -0.4 + (1 - gearFraction) * 1.5;
    this.mainGearGroup.scale.set(1, gearFraction, 1);
    this.mainGearGroup.position.y = (1 - gearFraction) * 1.8;

    // Yoke movement in cockpit
    this.yokeMesh.rotation.z = -state.rollInput * 0.7;
    this.yokeMesh.position.z = 1.2 - state.pitchInput * 0.15;

    // 3. Strobe & Beacon Light flashing
    this.strobeTimer += deltaSec;
    if (this.strobeTimer >= 1.2) {
      this.strobeTimer = 0;
    }
    this.strobeLight.intensity = this.strobeTimer < 0.08 ? 12 : 0;

    this.beaconTimer += deltaSec;
    if (this.beaconTimer >= 1.0) {
      this.beaconTimer = 0;
    }
    this.beaconLight.intensity = this.beaconTimer < 0.12 ? 8 : 0;

    // Landing headlights
    this.landingLight1.intensity = state.landingLights ? 8 : 0;
    this.landingLight2.intensity = state.landingLights ? 8 : 0;

    // 4. Update 4-Light PAPI system
    // Calculates actual glide slope angle from runway threshold (pos z = 180)
    const distFromThreshold = Math.hypot(state.x, state.z - 180);
    const altitudeAboveRwy = Math.max(0, state.y - 38);
    const actualAngleDeg = (Math.atan2(altitudeAboveRwy, Math.max(10, distFromThreshold)) * 180) / Math.PI;

    // Standard 3° glideslope tolerances:
    // > 3.4°: 4 White, 3.2-3.4°: 3 White 1 Red, 2.8-3.2°: 2 White 2 Red (On Slope!), 2.6-2.8°: 1 White 3 Red, < 2.6°: 4 Red (Too low!)
    const numWhite =
      actualAngleDeg > 3.4 ? 4 : actualAngleDeg > 3.1 ? 3 : actualAngleDeg > 2.8 ? 2 : actualAngleDeg > 2.5 ? 1 : 0;

    this.papiLights.forEach((lightMesh, idx) => {
      const isWhite = idx < numWhite;
      (lightMesh.material as THREE.MeshBasicMaterial).color.setHex(isWhite ? 0xffffff : 0xee2200);
    });

    // 5. Jetway & Pushback Tug behavior
    if (state.phase === 'parked' || state.phase === 'boarding') {
      this.jetway.position.set(state.x + 3.2, 0, state.z + 12);
      this.jetway.visible = true;
      this.pushbackTug.visible = false;
    } else if (state.phase === 'pushback') {
      this.jetway.visible = false;
      this.pushbackTug.visible = true;
      this.pushbackTug.position.set(state.x, 38, state.z + 16);
      this.pushbackTug.rotation.y = state.yaw;
    } else {
      this.jetway.visible = false;
      this.pushbackTug.visible = false;
    }

    // 6. Rain particles animation (move with aircraft)
    if (this.rainParticles.visible) {
      this.rainParticles.position.set(state.x, state.y, state.z);
      const posAttr = this.rainParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 1; i < posAttr.count * 3; i += 3) {
        posAttr.array[i] -= 450 * deltaSec;
        if (posAttr.array[i] < -200) {
          posAttr.array[i] = 400;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 7. Dynamic Camera Positioning
    this.updateCamera(state);

    // 8. Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(state: FlightState) {
    const aircraftPos = new THREE.Vector3(state.x, state.y, state.z);
    const spec = this.plan.aircraft;

    switch (this.cameraMode) {
      case 'cockpit': {
        // Pilot eye position in cockpit (left seat)
        const localPilotEye = new THREE.Vector3(-0.48, 1.2, spec.lengthM * 0.36);
        localPilotEye.applyAxisAngle(new THREE.Vector3(0, 0, 1), state.roll);
        localPilotEye.applyAxisAngle(new THREE.Vector3(1, 0, 0), state.pitch);
        localPilotEye.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);

        this.camera.position.copy(aircraftPos).add(localPilotEye);

        // Look forward through windshield with pilot look-around
        const lookDir = new THREE.Vector3(0, 0, 80);
        lookDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraOrbitPitch);
        lookDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraOrbitYaw);
        lookDir.applyAxisAngle(new THREE.Vector3(0, 0, 1), state.roll);
        lookDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), state.pitch);
        lookDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);

        this.camera.lookAt(this.camera.position.clone().add(lookDir));
        this.camera.up.set(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), state.roll);
        break;
      }

      case 'wing': {
        // Window seat looking out over the wing and engine
        const localWingEye = new THREE.Vector3(2.2, 0.4, -2.5);
        localWingEye.applyAxisAngle(new THREE.Vector3(0, 0, 1), state.roll);
        localWingEye.applyAxisAngle(new THREE.Vector3(1, 0, 0), state.pitch);
        localWingEye.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);

        this.camera.position.copy(aircraftPos).add(localWingEye);

        const lookTarget = new THREE.Vector3(18, -1.2, -6);
        lookTarget.applyAxisAngle(new THREE.Vector3(0, 0, 1), state.roll);
        lookTarget.applyAxisAngle(new THREE.Vector3(1, 0, 0), state.pitch);
        lookTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);

        this.camera.lookAt(aircraftPos.clone().add(lookTarget));
        this.camera.up.set(0, 1, 0);
        break;
      }

      case 'gear': {
        // Underside camera looking forward at nose/main gear on runway
        const localGearCam = new THREE.Vector3(0, -1.8, -6);
        localGearCam.applyAxisAngle(new THREE.Vector3(0, 0, 1), state.roll);
        localGearCam.applyAxisAngle(new THREE.Vector3(1, 0, 0), state.pitch);
        localGearCam.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);

        this.camera.position.copy(aircraftPos).add(localGearCam);

        const lookTarget = new THREE.Vector3(0, -2.5, 60);
        lookTarget.applyAxisAngle(new THREE.Vector3(0, 0, 1), state.roll);
        lookTarget.applyAxisAngle(new THREE.Vector3(1, 0, 0), state.pitch);
        lookTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);

        this.camera.lookAt(aircraftPos.clone().add(lookTarget));
        this.camera.up.set(0, 1, 0);
        break;
      }

      case 'chase':
      default: {
        // Third-person chase cam trailing behind: full view of plane from behind
        const dist = this.cameraDistance;
        const height = dist * 0.24 + 2.0;

        const offset = new THREE.Vector3(
          Math.sin(state.yaw + this.cameraOrbitYaw) * -dist,
          height + Math.sin(this.cameraOrbitPitch) * (dist * 0.4),
          Math.cos(state.yaw + this.cameraOrbitYaw) * -dist
        );

        this.camera.position.copy(aircraftPos).add(offset);
        // Look ahead over the fuselage down the runway and horizon
        const lookTarget = new THREE.Vector3(
          Math.sin(state.yaw) * 18,
          2.2,
          Math.cos(state.yaw) * 18
        );
        this.camera.lookAt(aircraftPos.clone().add(lookTarget));
        this.camera.up.set(0, 1, 0);
        break;
      }
    }
  }

  private onWindowResize = () => {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onWindowResize);
    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
