import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useTheme } from "../lib/ThemeContext";
import { 
  RotateCw, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Sun, 
  Moon, 
  Maximize2, 
  Minimize2, 
  Compass, 
  Ruler, 
  Gauge, 
  Utensils, 
  Globe, 
  ChevronRight, 
  Sparkles
} from "lucide-react";

interface SpecimenData {
  id: "kingfisher" | "hoopoe";
  name: string;
  latin: string;
  family: string;
  tags: string[];
  description: string;
  traits: { icon: any; label: string; value: string }[];
  habitat: string;
  caption: string;
  closeUpText: string;
  lensPosition: string;
  featuredTitle: string;
  featuredText: string;
  imageUrl: string;
  glbUrl: string;
}

const SPECIMENS: Record<"kingfisher" | "hoopoe", SpecimenData> = {
  kingfisher: {
    id: "kingfisher",
    name: "Common Kingfisher",
    latin: "Alcedo atthis",
    family: "ALCEDINIDAE",
    tags: ["River bird", "Diver", "Iridescent"],
    description:
      "A small, spectacular bird of rivers and lakes, renowned for its dazzling sapphire-copper plumage and astonishing hunting dives. A master of stealth and velocity.",
    traits: [
      { icon: Ruler, label: "Length", value: "16–17 cm" },
      { icon: Gauge, label: "Dive speed", value: "Up to 40 km/h" },
      { icon: Utensils, label: "Diet", value: "Small fish & aquatic nymphs" },
      { icon: Globe, label: "Range", value: "Eurasia & North Africa" },
    ],
    habitat: "Slow rivers, clean streams, reed-fringed lakes and estuaries.",
    caption: "Blink, and the river keeps its secret.",
    closeUpText:
      "An intricate mosaic of structural micro-prisms gives the kingfisher its unmistakable metallic sheen.",
    lensPosition: "24% 30%",
    featuredTitle: "A flash of river blue.",
    featuredText: "Extraordinary colours. A remarkable predatory life by the water.",
    imageUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_f9e3e60d-acdc-4925-b393-c4ce14b28711.png",
    glbUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073345_12721630-c589-442f-8884-e4a445cd8980.glb",
  },
  hoopoe: {
    id: "hoopoe",
    name: "Eurasian Hoopoe",
    latin: "Upupa epops",
    family: "UPUPIDAE",
    tags: ["Ground forager", "Crested", "Migrant"],
    description:
      "Unmistakable in cinnamon, black and white, the hoopoe walks open ground probing for subterranean larvae. It unfurls its magnificent crest into a crown when landing.",
    traits: [
      { icon: Ruler, label: "Length", value: "25–29 cm" },
      { icon: Gauge, label: "Wingspan", value: "44–48 cm" },
      { icon: Utensils, label: "Diet", value: "Insects, mole crickets & grubs" },
      { icon: Globe, label: "Range", value: "Europe, Asia & Africa" },
    ],
    habitat: "Orchards, vineyards, dry steppe and open savanna grassland.",
    caption: "A crown raised, and the orchard takes notice.",
    closeUpText:
      "Every crest feather ends in a jet-black terminal tip, so the raised fan reads like an ornate crown.",
    lensPosition: "62% 22%",
    featuredTitle: "A crown of cinnamon.",
    featuredText: "Bold bars on broad wings. A hollow resonant call heard before seen.",
    imageUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_21ed095c-d038-4ab5-87b7-b44e527ec449.png",
    glbUrl:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073347_06b339a7-70bc-4ecd-9e72-1a4143264da9.glb",
  },
};

export const FeatherAtlasStage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"kingfisher" | "hoopoe">("kingfisher");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isLensOpen, setIsLensOpen] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [, setZoomLevel] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeState = useRef<{
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    renderer?: THREE.WebGLRenderer;
    modelPivot?: THREE.Group;
    currentModel?: THREE.Object3D;
    keyLight?: THREE.DirectionalLight;
    rimLight?: THREE.DirectionalLight;
    targetZoom?: number;
    yawQueue?: number;
    isDragging?: boolean;
    lastMouseX?: number;
    lastMouseY?: number;
    rotVelX?: number;
    rotVelY?: number;
  }>({});

  const currentSpecimen = SPECIMENS[activeTab];

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene & PMREM environment
    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRenderTarget.texture;

    // Camera
    const camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    // Rig Groups
    const modelPivot = new THREE.Group();
    scene.add(modelPivot);

    // Directional Lights
    const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.6);
    keyLight.position.set(2.5, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbfd8ff, 0.5);
    rimLight.position.set(-4, 2, -3);
    scene.add(rimLight);

    threeState.current = {
      scene,
      camera,
      renderer,
      modelPivot,
      keyLight,
      rimLight,
      targetZoom: 1,
      yawQueue: 0,
      rotVelX: 0,
      rotVelY: 0,
    };

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      if (threeState.current.modelPivot) {
        // Idle sway
        if (!threeState.current.isDragging) {
          threeState.current.modelPivot.position.y = Math.sin(t * 1.3) * 0.025;
        }

        // Process queued rotations from turn pill
        if (threeState.current.yawQueue && Math.abs(threeState.current.yawQueue) > 0.001) {
          const step = threeState.current.yawQueue * (1 - Math.exp(-dt * 4.2));
          threeState.current.modelPivot.rotation.y += step;
          threeState.current.yawQueue -= step;
        }

        // Apply inertial rotation decay
        if (!threeState.current.isDragging) {
          if (threeState.current.rotVelY && Math.abs(threeState.current.rotVelY) > 0.0001) {
            threeState.current.modelPivot.rotation.y += threeState.current.rotVelY;
            threeState.current.rotVelY *= Math.exp(-dt * 4.5);
          }
          if (threeState.current.rotVelX && Math.abs(threeState.current.rotVelX) > 0.0001) {
            threeState.current.modelPivot.rotation.x += threeState.current.rotVelX;
            threeState.current.rotVelX *= Math.exp(-dt * 4.5);
          }
        }
      }

      // Smooth camera zoom
      if (camera && threeState.current.targetZoom) {
        const currentZ = camera.position.z;
        const targetZ = 5.2 / threeState.current.targetZoom;
        camera.position.z += (targetZ - currentZ) * (1 - Math.exp(-dt * 6));
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!canvas || !renderer || !camera) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      envRenderTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, []);

  // Load GLB specimen whenever activeTab changes
  useEffect(() => {
    const pivot = threeState.current.modelPivot;
    if (!pivot) return;

    setIsLoadingModel(true);
    setLoadError(false);

    if (threeState.current.currentModel) {
      pivot.remove(threeState.current.currentModel);
      threeState.current.currentModel = undefined;
    }

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(dracoLoader);

    const spec = SPECIMENS[activeTab];

    loader.load(
      spec.glbUrl,
      (gltf) => {
        const model = gltf.scene;

        const bbox = new THREE.Box3().setFromObject(model);
        const sphere = new THREE.Sphere();
        bbox.getBoundingSphere(sphere);

        model.position.sub(sphere.center);
        const scale = 1.3 / (sphere.radius || 1);
        model.scale.setScalar(scale);

        pivot.rotation.set(0.12, 0.75, 0, "YXZ");
        pivot.add(model);
        threeState.current.currentModel = model;
        setIsLoadingModel(false);
      },
      undefined,
      (err) => {
        console.warn("GLB load failed, falling back to 2D cutout:", err);
        setLoadError(true);
        setIsLoadingModel(false);
      }
    );

    return () => {
      dracoLoader.dispose();
    };
  }, [activeTab]);

  // Handle Day/Dusk Lighting switch
  useEffect(() => {
    const key = threeState.current.keyLight;
    const rim = threeState.current.rimLight;
    const renderer = threeState.current.renderer;

    if (!key || !rim || !renderer) return;

    if (theme === "dusk") {
      key.color.setHex(0xffc98a);
      key.intensity = 2.6;
      rim.color.setHex(0x9cb8ff);
      rim.intensity = 1.9;
      renderer.toneMappingExposure = 1.0;
    } else {
      key.color.setHex(0xfff4e2);
      key.intensity = 1.6;
      rim.color.setHex(0xbfd8ff);
      rim.intensity = 0.5;
      renderer.toneMappingExposure = 1.05;
    }
  }, [theme]);

  // Pointer drag controls for 3D stage
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    threeState.current.isDragging = true;
    threeState.current.lastMouseX = e.clientX;
    threeState.current.lastMouseY = e.clientY;
    threeState.current.rotVelX = 0;
    threeState.current.rotVelY = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!threeState.current.isDragging || !threeState.current.modelPivot) return;
    const dx = e.clientX - (threeState.current.lastMouseX ?? e.clientX);
    const dy = e.clientY - (threeState.current.lastMouseY ?? e.clientY);

    threeState.current.lastMouseX = e.clientX;
    threeState.current.lastMouseY = e.clientY;

    const rotY = dx * 0.008;
    const rotX = dy * 0.008;

    threeState.current.modelPivot.rotation.y += rotY;
    threeState.current.modelPivot.rotation.x += rotX;

    threeState.current.rotVelY = rotY;
    threeState.current.rotVelX = rotX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    threeState.current.isDragging = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.88;
    const nextZoom = Math.min(Math.max((threeState.current.targetZoom || 1) * factor, 0.6), 3.2);
    threeState.current.targetZoom = nextZoom;
    setZoomLevel(nextZoom);
  };

  const triggerYaw = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    threeState.current.yawQueue = (threeState.current.yawQueue || 0) + rad;
  };

  const resetStage = () => {
    if (threeState.current.modelPivot) {
      threeState.current.modelPivot.rotation.set(0.12, 0.75, 0, "YXZ");
    }
    threeState.current.targetZoom = 1;
    threeState.current.yawQueue = 0;
    setZoomLevel(1);
  };

  const toggleLens = () => {
    const nextState = !isLensOpen;
    setIsLensOpen(nextState);
    const targetZ = nextState ? 2.5 : 1.0;
    threeState.current.targetZoom = targetZ;
    setZoomLevel(targetZ);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-65px)] min-h-[640px] flex flex-col lg:flex-row overflow-hidden transition-colors duration-600 select-none bg-[var(--bg)] text-[var(--ink)]"
    >
      {/* 1. Left Sidebar Navigation (Desktop) */}
      <aside
        className={`w-full lg:w-64 xl:w-72 p-5 border-r border-[var(--line)] bg-[var(--bg)] flex-col justify-between hidden lg:flex shrink-0 transition-transform duration-500 ${
          isFocusMode ? "-translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-[var(--sage)]" />
            <h2 className="text-base font-bold tracking-tight text-[var(--ink)] font-display">
              Feather Atlas
            </h2>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] px-2 block mb-2">
              Select 3D Specimen
            </span>
            {(["kingfisher", "hoopoe"] as const).map((key) => {
              const spec = SPECIMENS[key];
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                    active
                      ? "bg-[var(--sage-tint)] border border-[var(--sage)]/40 text-[var(--ink)] shadow-sm font-semibold"
                      : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)] border border-transparent"
                  }`}
                >
                  <img
                    src={spec.imageUrl}
                    alt={spec.name}
                    className="w-12 h-10 object-contain drop-shadow"
                  />
                  <div className="text-left">
                    <div className="text-xs font-bold text-[var(--ink)]">{spec.name}</div>
                    <div className="text-[11px] text-[var(--sage)] italic font-display">
                      {spec.latin}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Specimen Card pinned at bottom */}
        <div className="p-4 rounded-2xl bg-[var(--panel)] border border-[var(--line)] text-left shadow-sm">
          <span className="text-[9px] font-mono tracking-widest uppercase text-[var(--sage)] font-bold block mb-1">
            FEATURED SPECIMEN
          </span>
          <h4 className="text-sm font-bold text-[var(--ink)] font-display mb-1">
            {currentSpecimen.featuredTitle}
          </h4>
          <p className="text-xs text-[var(--muted)] leading-relaxed mb-3">
            {currentSpecimen.featuredText}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[var(--sage)] font-semibold">
            <span>Rotatable 3D Asset</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </aside>

      {/* 2. Centre 3D WebGL Stage */}
      <section className="relative flex-1 h-full flex flex-col justify-between overflow-hidden bg-[var(--bg)]">
        {/* Top specimen tabs (Mobile & Tablet) */}
        <div className="lg:hidden flex items-center justify-center gap-2 p-3 z-20">
          {(["kingfisher", "hoopoe"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === key
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                  : "bg-[var(--panel)] text-[var(--muted)] border border-[var(--line)]"
              }`}
            >
              <span>{SPECIMENS[key].name}</span>
            </button>
          ))}
        </div>

        {/* 3D Canvas */}
        <div
          className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onDoubleClick={resetStage}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />

          {/* Ground shadow beneath the 3D model */}
          <div className="absolute bottom-[15%] w-72 h-8 rounded-full bg-[rgba(var(--shadow),0.18)] blur-xl pointer-events-none" />

          {/* Fallback or Loading overlay */}
          {isLoadingModel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[var(--bg)]/60 backdrop-blur-sm pointer-events-none">
              <div className="w-10 h-10 border-2 border-[var(--line)] border-t-[var(--sage)] rounded-full animate-spin mb-3" />
              <span className="text-xs font-semibold text-[var(--muted)]">Preparing the specimen…</span>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none p-6 text-center">
              <img
                src={currentSpecimen.imageUrl}
                alt={currentSpecimen.name}
                className="max-h-64 object-contain drop-shadow-[0_20px_40px_rgba(var(--shadow),0.5)] mb-4 animate-pulse-subtle"
              />
              <span className="text-xs text-[var(--muted)] bg-[var(--panel)] px-3 py-1.5 rounded-full border border-[var(--line)]">
                Offline High-Res Orthographic Plate (Drag to examine)
              </span>
            </div>
          )}

          {/* Left Vertical Icon Rail */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
            <button
              onClick={() => {
                const z = Math.min((threeState.current.targetZoom || 1) * 1.35, 3.2);
                threeState.current.targetZoom = z;
                setZoomLevel(z);
              }}
              className="p-2.5 rounded-full bg-[var(--panel)] hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] hover:border-[var(--sage)] shadow-sm transition-colors cursor-pointer"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const z = Math.max((threeState.current.targetZoom || 1) / 1.35, 0.6);
                threeState.current.targetZoom = z;
                setZoomLevel(z);
              }}
              className="p-2.5 rounded-full bg-[var(--panel)] hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] hover:border-[var(--sage)] shadow-sm transition-colors cursor-pointer"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-full border shadow-sm transition-all cursor-pointer ${
                theme === "dusk"
                  ? "bg-[var(--sage-tint)] text-[var(--sage)] border-[var(--sage)]/40"
                  : "bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--ink)] border-[var(--line)]"
              }`}
              title="Toggle Day/Dusk Lighting"
              aria-label="Toggle Lighting"
            >
              {theme === "dusk" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="p-2.5 rounded-full bg-[var(--panel)] hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] hover:border-[var(--sage)] shadow-sm transition-colors cursor-pointer"
              title="Focus Mode"
              aria-label="Toggle Focus Mode"
            >
              {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Turn Pill (Bottom Center) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-full bg-[var(--panel)] border border-[var(--line)] shadow-lg backdrop-blur-md z-20">
            <button
              onClick={() => triggerYaw(-90)}
              className="p-2 rounded-full hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              title="Rotate Counter-Clockwise 90°"
              aria-label="Rotate -90 deg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => triggerYaw(360)}
              className="px-3 py-1 text-xs font-mono font-bold text-[var(--sage)] hover:bg-[var(--sage-tint)] rounded-full transition-colors cursor-pointer"
              title="Perform Full 360° Inspection"
            >
              360°
            </button>
            <button
              onClick={() => triggerYaw(90)}
              className="p-2 rounded-full hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              title="Rotate Clockwise 90°"
              aria-label="Rotate +90 deg"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stage Caption Bottom Center */}
        <div className="w-full text-center pb-2 z-10 pointer-events-none">
          <p className="text-xs text-[var(--muted)] italic font-display">
            "{currentSpecimen.caption}"
          </p>
        </div>
      </section>

      {/* 3. Right Info & Anatomical Traits Column */}
      <aside
        className={`w-full lg:w-80 xl:w-96 p-6 border-t lg:border-t-0 lg:border-l border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between shrink-0 overflow-y-auto transition-transform duration-500 z-20 ${
          isFocusMode ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
        }`}
      >
        <div>
          {/* Header */}
          <div className="mb-4">
            <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--sage)] font-bold">
              {currentSpecimen.family}
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)] font-display mt-1">
              {currentSpecimen.name}
            </h1>
            <p className="text-sm text-[var(--muted)] italic font-display mt-0.5">
              {currentSpecimen.latin}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {currentSpecimen.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-3 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] border border-[var(--line)] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-xs text-[var(--ink)] leading-relaxed mb-6 font-normal">
            {currentSpecimen.description}
          </p>

          {/* Key Traits */}
          <div className="mb-6">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--muted)] pb-2 border-b border-[var(--line)] mb-3 font-semibold">
              Key Traits
            </h3>
            <div className="space-y-2.5">
              {currentSpecimen.traits.map((trait) => {
                const Icon = trait.icon;
                return (
                  <div key={trait.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[var(--muted)]">
                      <Icon className="w-3.5 h-3.5 text-[var(--sage)]" />
                      <span>{trait.label}</span>
                    </div>
                    <span className="font-bold text-[var(--ink)]">{trait.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Habitat */}
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] mb-6">
            <div className="flex items-center gap-1.5 text-xs text-[var(--sage)] font-bold mb-1">
              <Compass className="w-3.5 h-3.5" />
              <span>Habitat</span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {currentSpecimen.habitat}
            </p>
          </div>
        </div>

        {/* Close-up Lens Detail Button */}
        <button
          onClick={toggleLens}
          className={`w-full p-3.5 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
            isLensOpen
              ? "bg-[var(--sage-tint)] border-[var(--sage)] text-[var(--ink)]"
              : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--sage)] text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full border border-[var(--sage)]/50 overflow-hidden shrink-0 shadow-sm"
              style={{
                backgroundImage: `url(${currentSpecimen.imageUrl})`,
                backgroundSize: "480%",
                backgroundPosition: currentSpecimen.lensPosition,
              }}
            />
            <div className="text-left">
              <div className="text-xs font-bold text-[var(--ink)]">Close-up Micro Lens</div>
              <div className="text-[10px] text-[var(--muted)]">
                {isLensOpen ? "Click to reset zoom" : "Inspect feather microstructure"}
              </div>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-[var(--sage)] transition-transform ${
              isLensOpen ? "rotate-90" : ""
            }`}
          />
        </button>
      </aside>
    </div>
  );
};
