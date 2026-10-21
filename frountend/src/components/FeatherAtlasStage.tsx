import { BIRD_MODELS, SKETCHFAB_BY_SPECIES } from "../data/birdModels";
import { BirdAudioButton } from "./BirdAudioButton";
import { conservationLabel } from "../lib/conservation";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useTheme } from "../lib/ThemeContext";
import type { BirdSpecies } from "../data/mockBirds";
import { applyAudio, applyDetail, fromListItem } from "../lib/adapt";
import {
  ApiError,
  getSpecies,
  getSpeciesAudio,
  getTrackedSpecies,
  listSpecies,
  type TrackedSpecies,
} from "../lib/api";
import { FlywayMap } from "./FlywayMap";
import { birdAudio } from "../lib/birdAudio";
import { Link } from "react-router-dom";
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
  Layers,
  Feather,
  Globe2,
  ChevronRight,
  Sparkles,
  Navigation2,
  Radio,
  Activity,
  Weight,
  Volume2,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin
} from "lucide-react";

function disposeModel(model: THREE.Object3D) {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) value.dispose(); });
      material.dispose();
    });
  });
}

interface SpecimenAsset {
  id: string;
  glbUrl?: string;
  caption: string;
  featuredTitle: string;
  featuredText: string;
  lensPosition: string;
}

/** Real binomials for the two specimens that ship a WebGL model. */
const GLB_BY_SPECIES: Record<string, string> = {
  "Alcedo atthis":
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073345_12721630-c589-442f-8884-e4a445cd8980.glb",
  "Upupa epops":
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073347_06b339a7-70bc-4ecd-9e72-1a4143264da9.glb",
};

/** Prose that belongs to each filled model; falls back to live API text. */
const GLB_PROSE: Record<string, { caption: string; featuredTitle: string; featuredText: string; lensPosition: string }> = {
  "Alcedo atthis": {
    caption: "Blink, and the river keeps its secret.",
    featuredTitle: "A flash of river blue.",
    featuredText: "Extraordinary colours. A remarkable predatory life by the water.",
    lensPosition: "24% 30%",
  },
  "Upupa epops": {
    caption: "A crown raised, and the orchard takes notice.",
    featuredTitle: "A crown of cinnamon.",
    featuredText: "Bold bars on broad wings. A hollow resonant call heard before seen.",
    lensPosition: "62% 22%",
  },
};

const assetFor = (bird: BirdSpecies): SpecimenAsset => {
  const prose = GLB_PROSE[bird.scientificName];
  return {
    id: bird.scientificName,
    glbUrl: GLB_BY_SPECIES[bird.scientificName],
    caption: prose?.caption ?? `Explore ${bird.name} in three dimensions.`,
    featuredTitle: prose?.featuredTitle ?? bird.name,
    featuredText: prose?.featuredText ?? (bird.description || bird.sublabel),
    lensPosition: prose?.lensPosition ?? "50% 50%",
  };
};

type StageMode = "3d" | "flyway";
type SidebarTab = "morphometrics" | "ecology" | "telemetry" | "conservation";

export const FeatherAtlasStage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  // Selected specimen
  const [specimenSearch, setSpecimenSearch] = useState("");
  const [birds, setBirds] = useState<BirdSpecies[]>([]);
  const [tracked, setTracked] = useState<TrackedSpecies[]>([]);
  const [selectedBirdId, setSelectedBirdId] = useState<string>("");
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [stageMode, setStageMode] = useState<StageMode>("3d");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("morphometrics");

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

  const currentBird: BirdSpecies | null =
    birds.find((b) => b.id === selectedBirdId) || birds[0] || null;

  const currentEmbed = SKETCHFAB_BY_SPECIES.get(currentBird?.scientificName ?? "");
  const visibleBirds = birds.filter((bird) => `${bird.name} ${bird.scientificName} ${bird.order}`.toLowerCase().includes(specimenSearch.toLowerCase()));

  const currentAsset: SpecimenAsset = currentBird
    ? assetFor(currentBird)
    : {
        id: "",
        caption: "Awaiting the catalogue.",
        featuredTitle: "Feather Atlas",
        featuredText: "Connect to the species API to hold a specimen here.",
        lensPosition: "50% 50%",
      };

  const isVulnerable = Boolean(
    currentBird &&
      (currentBird.conservation?.threatened ||
        currentBird.iucnCategory === "VU" ||
        currentBird.iucnCategory === "EN" || currentBird.iucnCategory === "CR")
  );

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // 0a. Fill the specimen rail from the catalogue
  useEffect(() => {
    let cancelled = false;
    setIsCatalogLoading(true);

    const names = [...Object.keys(GLB_BY_SPECIES), ...BIRD_MODELS.map((model) => model.scientificName)];
    Promise.all([
      listSpecies({ names: names.join(","), page_size: 100, sort: "taxonomic" }),
      getTrackedSpecies().catch(() => [] as TrackedSpecies[]),
    ])
      .then(([page, telemetry]) => {
        if (cancelled) return;
        const next = page.items.map(fromListItem).sort((a, b) => {
          const aLocal = a.scientificName in GLB_BY_SPECIES;
          const bLocal = b.scientificName in GLB_BY_SPECIES;
          return Number(bLocal) - Number(aLocal) || a.order.localeCompare(b.order) || a.name.localeCompare(b.name);
        });
        setBirds(next);
        setTracked(telemetry);
        setSelectedBirdId((prev) =>
          prev && next.some((b) => b.id === prev) ? prev : next[0]?.id ?? ""
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setCatalogError(
          err instanceof ApiError ? err.message : "Could not reach the specimen catalogue."
        );
      })
      .finally(() => {
        if (!cancelled) setIsCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => birdAudio.stop(), [selectedBirdId]);

  // 0b. Fold the full record (traits, conservation, prose, audio) into the rail entry
  useEffect(() => {
    if (!selectedBirdId) return;
    let cancelled = false;
    const name = selectedBirdId;

    getSpecies(name)
      .then((detail) => {
        if (cancelled) return;
        setBirds((prev) =>
          prev.map((b) => (b.id === name ? applyDetail(b, detail) : b))
        );
        return getSpeciesAudio(name, 1).catch(() => null);
      })
      .then((audio) => {
        if (cancelled || !audio) return;
        setBirds((prev) =>
          prev.map((b) => (b.id === name ? applyAudio(b, audio) : b))
        );
      })
      .catch(() => {
        /* the list-derived entry already renders; detail is an enhancement */
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBirdId]);

  // 1. Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || stageMode !== "3d" || currentEmbed) return;

    const canvas = canvasRef.current;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

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

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRenderTarget.texture;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 0.2, 3.2);

    const modelPivot = new THREE.Group();
    scene.add(modelPivot);

    const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.6);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbfd8ff, 0.5);
    rimLight.position.set(-3, -2, -2);
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
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (threeState.current.yawQueue !== undefined && Math.abs(threeState.current.yawQueue) > 0.001) {
        const step = threeState.current.yawQueue * 0.12;
        modelPivot.rotation.y += step;
        threeState.current.yawQueue -= step;
      }

      if (!threeState.current.isDragging) {
        if (threeState.current.rotVelX) {
          modelPivot.rotation.x += threeState.current.rotVelX;
          threeState.current.rotVelX *= 0.92;
        }
        if (threeState.current.rotVelY) {
          modelPivot.rotation.y += threeState.current.rotVelY;
          threeState.current.rotVelY *= 0.92;
        }
      }

      if (threeState.current.targetZoom !== undefined) {
        const targetZ = 3.2 / threeState.current.targetZoom;
        camera.position.z += (targetZ - camera.position.z) * 0.1;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!canvas || !renderer || !camera) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      envRenderTarget.dispose();
      pmremGenerator.dispose();
      if (threeState.current.currentModel) disposeModel(threeState.current.currentModel);
      renderer.dispose();
      threeState.current = {};
    };
  }, [isCatalogLoading, stageMode, Boolean(currentEmbed)]);

  // 2. Load 3D GLB or switch specimen
  useEffect(() => {
    const pivot = threeState.current.modelPivot;
    if (!pivot || currentEmbed || stageMode !== "3d") return;
    let cancelled = false;

    setIsLoadingModel(true);
    setLoadError(false);

    if (threeState.current.currentModel) {
      pivot.remove(threeState.current.currentModel);
      threeState.current.currentModel = undefined;
    }

    if (!currentAsset.glbUrl) {
      // Graceful fallback for species with orthographic plates
      setIsLoadingModel(false);
      setLoadError(true);
      return;
    }

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      currentAsset.glbUrl,
      (gltf) => {
        const model = gltf.scene;
        if (cancelled) { disposeModel(model); return; }
        const bbox = new THREE.Box3().setFromObject(model);
        const sphere = new THREE.Sphere();
        bbox.getBoundingSphere(sphere);

        const scale = 1.3 / (sphere.radius || 1);
        model.scale.setScalar(scale);
        model.position.copy(sphere.center).multiplyScalar(-scale);

        pivot.rotation.set(0.12, 0.75, 0, "YXZ");
        pivot.add(model);
        threeState.current.currentModel = model;
        setIsLoadingModel(false);
      },
      undefined,
      (err) => {
        if (cancelled) return;
        console.warn("GLB load fallback:", err);
        setLoadError(true);
        setIsLoadingModel(false);
      }
    );

    return () => {
      cancelled = true;
      if (threeState.current.currentModel) {
        pivot.remove(threeState.current.currentModel);
        disposeModel(threeState.current.currentModel);
        threeState.current.currentModel = undefined;
      }
      dracoLoader.dispose();
    };
  }, [selectedBirdId, currentAsset.glbUrl, stageMode, Boolean(currentEmbed), isCatalogLoading]);

  // 3. Day/Dusk Lighting switch
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
  }, [theme, stageMode, Boolean(currentEmbed), isCatalogLoading]);

  // Interaction handlers
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
    const currentZoom = threeState.current.targetZoom || 1;
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = Math.min(Math.max(currentZoom * factor, 0.6), 3.2);
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
    setZoomLevel(1);
    setIsLensOpen(false);
  };

  const toggleLens = () => {
    if (isLensOpen) {
      threeState.current.targetZoom = 1;
      setZoomLevel(1);
      setIsLensOpen(false);
    } else {
      threeState.current.targetZoom = 2.4;
      setZoomLevel(2.4);
      setIsLensOpen(true);
    }
  };


  if (isCatalogLoading) {
    return (
      <div className="w-full h-[calc(100vh-65px)] min-h-[560px] flex flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[var(--muted)]">
        <div className="w-10 h-10 border-2 border-[var(--line)] border-t-[var(--sage)] rounded-full animate-spin" />
        <span className="text-xs font-mono">Opening the specimen cabinet…</span>
      </div>
    );
  }

  if (catalogError || !currentBird) {
    return (
      <div className="w-full h-[calc(100vh-65px)] min-h-[560px] flex flex-col items-center justify-center gap-3 bg-[var(--bg)] text-center px-6">
        <Feather className="w-6 h-6 text-[var(--sage)]" />
        <p className="text-sm font-semibold font-display text-[var(--ink)]">
          {catalogError ?? "The catalogue came back empty."}
        </p>
        <p className="text-xs text-[var(--muted)] max-w-md">
          Start the API with <code className="font-mono">uvicorn app.main:app --reload</code>, then
          reload this page.
        </p>
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      className="relative w-full h-auto lg:h-[calc(100dvh-80px)] min-h-[560px] flex flex-col lg:flex-row overflow-hidden bg-[var(--bg)] text-[var(--ink)] select-none transition-colors duration-600"
    >
      {/* 1. Left Specimen Rail */}
      <aside
        className={`w-full lg:w-72 xl:w-80 max-h-[240px] lg:max-h-none lg:h-full p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between shrink-0 overflow-y-auto transition-transform duration-500 z-20 ${
          isFocusMode ? "!hidden" : ""
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--sage)]" />
              <h2 className="text-base font-bold tracking-tight text-[var(--ink)] font-display">
                Feather Atlas
              </h2>
            </div>
            <Link
              to="/flyways"
              className="text-[10.5px] font-mono text-[var(--sage)] hover:underline flex items-center gap-1"
            >
              <span>Map Archive</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] px-2 block mb-2 font-bold">
              Select Avian Specimen
            </span>

            <input type="search" aria-label="Find a 3D bird" placeholder={`Find a bird (${birds.length} models)`}
              value={specimenSearch} onChange={(event) => setSpecimenSearch(event.target.value)}
              className="w-full px-3 py-2 mb-3 rounded-lg bg-[var(--bg)] text-xs border border-[var(--line)]" />
            {visibleBirds.length === 0 && <p className="p-2 text-xs text-[var(--muted)]">No matching specimens.</p>}
            {visibleBirds.map((bird) => {
              const active = selectedBirdId === bird.id;
              return (
                <button
                  key={bird.id}
                  onClick={() => setSelectedBirdId(bird.id)}
                  aria-pressed={active}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                    active
                      ? "bg-[var(--sage-tint)] border border-[var(--sage)]/40 text-[var(--ink)] shadow-sm font-semibold"
                      : "text-[var(--muted)] hover:bg-[var(--chip)] hover:text-[var(--ink)] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {bird.imageUrl ? (
                      <img
                        src={SKETCHFAB_BY_SPECIES.get(bird.scientificName)?.thumbnailUrl ?? bird.imageUrl}
                        loading="lazy"
                        alt={bird.name}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-10 h-10 object-contain drop-shadow bg-[var(--bg)] p-1 rounded-lg border border-[var(--line)]"
                      />
                    ) : (
                      <span className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)]">
                        <Feather className="w-4 h-4 text-[var(--muted)]" />
                      </span>
                    )}
                    <div className="text-left">
                      <div className="text-xs font-bold text-[var(--ink)] truncate max-w-[130px]">
                        {bird.name}
                      </div>
                      <div className="text-[10.5px] text-[var(--sage)] italic font-display truncate max-w-[130px]">
                        {bird.scientificName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {(GLB_BY_SPECIES[bird.scientificName] || SKETCHFAB_BY_SPECIES.has(bird.scientificName)) && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--sage-tint)] text-[var(--sage)] border border-[var(--sage)]/30">
                        3D
                      </span>
                    )}
                    {bird.telemetry?.hasTracking && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--chip)] text-[var(--muted)] border border-[var(--line)]">
                        GPS
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Featured Specimen Card */}
        <div className="hidden lg:block p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] text-left shadow-sm mt-4">
          <span className="text-[9px] font-mono tracking-widest uppercase text-[var(--sage)] font-bold block mb-1">
            ACTIVE ANATOMICAL PROFILE
          </span>
          <h4 className="text-sm font-bold text-[var(--ink)] font-display mb-1">
            {currentAsset.featuredTitle}
          </h4>
          <p className="text-xs text-[var(--muted)] leading-relaxed mb-3 line-clamp-2">
            {currentAsset.featuredText}
          </p>
          <div className="flex items-center justify-between text-xs text-[var(--sage)] font-semibold">
            <button
              onClick={() => setStageMode(stageMode === "3d" ? "flyway" : "3d")}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{stageMode === "3d" ? "Switch to Flyway Map" : "Switch to 3D Anatomy"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Centre Visual Stage: 3D WebGL Model vs Interactive Leaflet Flyway Map */}
      <section className="relative flex-1 h-[520px] lg:h-full min-h-[520px] lg:min-h-0 shrink-0 flex flex-col justify-between overflow-hidden bg-[var(--bg)]">
        {/* Top Stage Mode Switcher (The game changer requested by the user!) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center p-1.5 rounded-full liquid-glass-capsule liquid-bevel shadow-2xl">
          <button
            onClick={() => setStageMode("3d")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              stageMode === "3d"
                ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]/60"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3D specimen</span>
          </button>

          <button
            onClick={() => setStageMode("flyway")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              stageMode === "flyway"
                ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-md"
                : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]/60"
            }`}
          >
            <Navigation2 className="w-3.5 h-3.5" />
            <span>Migration map</span>
          </button>
        </div>

        {/* View 1: 3D WebGL Canvas */}
        {stageMode === "3d" && currentEmbed ? (
          <div className="relative w-full h-full min-h-[430px] flex flex-col pt-20 pb-4 px-3 sm:px-5">
            <iframe key={currentEmbed.uid}
              src={`${currentEmbed.embedUrl}?autostart=1&max_texture_size=1024&ui_theme=${theme === "dusk" ? "dark" : "light"}&dnt=1`}
              title={`3D specimen: ${currentBird.name} by ${currentEmbed.author}`}
              allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen
              className="w-full flex-1 min-h-[330px] rounded-xl border-0" />
            <p className="text-[11px] text-[var(--muted)] leading-relaxed pt-3">
              <a href={currentEmbed.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{currentEmbed.title}</a>
              {" by "}{currentEmbed.author}{" · "}
              <a href={currentEmbed.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{currentEmbed.license}</a>
              {" · Museum specimen via Sketchfab. Drag to rotate; scroll to zoom."}
            </p>
          </div>
        ) : stageMode === "3d" ? (
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

            {/* Loading or Orthographic fallback */}
            {isLoadingModel && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[var(--bg)]/60 backdrop-blur-sm pointer-events-none">
                <div className="w-10 h-10 border-2 border-[var(--line)] border-t-[var(--sage)] rounded-full animate-spin mb-3" />
                <span className="text-xs font-semibold text-[var(--muted)]">Preparing the specimen…</span>
              </div>
            )}

            {loadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none p-6 text-center">
                <img
                  src={currentBird.imageUrl}
                  alt={currentBird.name}
                  className="max-h-64 object-contain drop-shadow-[0_20px_40px_rgba(var(--shadow),0.5)] mb-4 animate-pulse-subtle"
                />
                <span className="text-xs text-[var(--muted)] liquid-glass-capsule px-3 py-1.5 rounded-full border border-[rgba(var(--line-rgb),0.7)] shadow-sm">
                  Specimen image · 3D model unavailable
                </span>
              </div>
            )}

            {/* Left Vertical Icon Rail for 3D Camera & Light Controls */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
              <button
                onClick={() => {
                  const z = Math.min((threeState.current.targetZoom || 1) * 1.35, 3.2);
                  threeState.current.targetZoom = z;
                  setZoomLevel(z);
                }}
                className="p-2.5 rounded-full liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const z = Math.max((threeState.current.targetZoom || 1) / 1.35, 0.6);
                  threeState.current.targetZoom = z;
                  setZoomLevel(z);
                }}
                className="p-2.5 rounded-full liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                onClick={toggleTheme}
                className={`p-2.5 rounded-full liquid-glass-capsule hover:scale-105 active:scale-95 shadow-md transition-all cursor-pointer ${
                  theme === "dusk"
                    ? "text-[var(--sage)] border-[var(--sage)]/40"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
                title="Toggle Day/Dusk Lighting"
              >
                {theme === "dusk" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsFocusMode(!isFocusMode)}
                className="p-2.5 rounded-full liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                title="Focus Mode"
              >
                {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Turn Pill (Bottom Center) - Liquid Glass Capsule */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-full liquid-glass-capsule liquid-bevel shadow-2xl z-20">
              <button
                onClick={() => triggerYaw(-90)}
                className="p-2 rounded-full hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                title="Rotate Counter-Clockwise 90°"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => triggerYaw(360)}
                className="px-3.5 py-1 text-xs font-mono font-bold text-[var(--sage)] hover:bg-[var(--sage-tint)]/80 rounded-full transition-colors cursor-pointer"
                title="Perform Full 360° Inspection"
              >
                360°
              </button>
              <button
                onClick={() => triggerYaw(90)}
                className="p-2 rounded-full hover:bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                title="Rotate Clockwise 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* View 2: Interactive Geospatial Migration & Flyway Map */
          <div className="relative w-full h-full pt-14">
            <FlywayMap
              species={tracked}
              initialSpeciesId={currentBird.scientificName}
              height="100%"
              showSidebar={false}
            />
          </div>
        )}

        {/* Stage Caption Bottom Center */}
        <div className="w-full text-center pb-2 z-10 pointer-events-none">
          <p className="text-xs text-[var(--muted)] italic font-display">
            "{currentAsset.caption}"
          </p>
        </div>
      </section>

      {/* 3. Right Scientific Dossier Column (Fully Enriched with AVONET & Movebank Data) */}
      <aside
        className={`w-full lg:w-80 xl:w-96 p-5 sm:p-6 border-t lg:border-t-0 lg:border-l border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between shrink-0 overflow-y-auto transition-transform duration-500 z-20 ${
          isFocusMode ? "!hidden" : ""
        }`}
      >
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10.5px] font-mono tracking-widest uppercase text-[var(--sage)] font-bold">
                {currentBird.order} · {currentBird.family}
              </span>

              {/* IUCN Status Badge */}
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isVulnerable
                    ? "bg-[#b28236]/15 text-[#c4923f] border-[#b28236]/30"
                    : "bg-[var(--sage-tint)] text-[var(--sage)] border-[var(--sage)]/25"
                }`}
              >
                {isVulnerable ? (
                  <ShieldAlert className="w-3 h-3 text-[#c4923f]" />
                ) : (
                  <ShieldCheck className="w-3 h-3 text-[var(--sage)]" />
                )}
                <span>{conservationLabel(currentBird.conservation?.rlCategory || currentBird.iucnCategory)}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)] font-display mt-0.5">
              {currentBird.name}
            </h1>
            <p className="text-xs text-[var(--muted)] italic font-display mt-0.5">
              {currentBird.scientificName} ({currentBird.commonName})
            </p>
          </div>

          {/* Audio Vocalization Chirp Pill */}
          <div className="flex items-center gap-2">
            <BirdAudioButton scientificName={currentBird.scientificName} name={currentBird.name} />

            {currentBird.telemetry?.hasTracking && (
              <button
                onClick={() => setStageMode("flyway")}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--sage-tint)] text-[var(--sage)] border border-[var(--sage)]/30 hover:bg-[var(--sage)] hover:text-[var(--sage-ink)] transition-all cursor-pointer flex items-center gap-1.5"
                title="Inspect real GPS animal-borne tracks on map"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Flyway</span>
              </button>
            )}
          </div>

          {/* Dossier Tabs Navigation */}
          <div className="flex items-center gap-1 border-b border-[var(--line)] pb-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSidebarTab("morphometrics")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                sidebarTab === "morphometrics"
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Morphometrics
            </button>

            <button
              onClick={() => setSidebarTab("ecology")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                sidebarTab === "ecology"
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Ecology
            </button>

            <button
              onClick={() => setSidebarTab("telemetry")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                sidebarTab === "telemetry"
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Telemetry
            </button>

            <button
              onClick={() => setSidebarTab("conservation")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                sidebarTab === "conservation"
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Status
            </button>
          </div>

          {/* TAB 1: MORPHOMETRICS & AERODYNAMICS */}
          {sidebarTab === "morphometrics" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)]">Culmen Beak</div>
                  <div className="text-xs font-bold text-[var(--ink)] mt-0.5">
                    {currentBird.morphometrics?.beakLengthCulmenMm || "—"} mm
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)]">Depth × Width</div>
                  <div className="text-xs font-bold text-[var(--ink)] mt-0.5">
                    {currentBird.morphometrics?.beakDepthMm || "—"} × {currentBird.morphometrics?.beakWidthMm || "—"} mm
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)]">Wing Length</div>
                  <div className="text-xs font-bold text-[var(--ink)] mt-0.5">
                    {currentBird.morphometrics?.wingLengthMm || "—"} mm
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)]">Body Mass</div>
                  <div className="text-xs font-bold text-[var(--ink)] mt-0.5">
                    {currentBird.morphometrics?.massFormatted || currentBird.massG}
                  </div>
                </div>
              </div>

              {/* Hand-Wing Index (HWI) Aerodynamic Gauge */}
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-[var(--ink)]">Hand-Wing Index (HWI)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--sage-tint)] text-[var(--sage)] font-bold">
                    Score: {currentBird.morphometrics?.handWingIndex || 24}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--line)] overflow-hidden my-1">
                  <div
                    className="h-full rounded-full bg-[var(--sage)]"
                    style={{
                      width: `${Math.min(Math.max((currentBird.morphometrics?.handWingIndex || 20) * 1.4, 15), 100)}%`,
                    }}
                  />
                </div>
                <div className="text-[9.5px] text-[var(--muted)] mt-1">
                  Measures wing pointedness and transcontinental dispersal efficiency.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ECOLOGY & HABITAT */}
          {sidebarTab === "ecology" && (
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <span className="text-[10px] text-[var(--muted)] block">Trophic Level & Niche</span>
                <span className="font-bold text-[var(--ink)]">
                  {currentBird.ecology?.trophicLevel} · {currentBird.ecology?.trophicNiche}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <span className="text-[10px] text-[var(--muted)] block">Primary Lifestyle</span>
                <span className="font-bold text-[var(--ink)]">
                  {currentBird.ecology?.primaryLifestyle} ({currentBird.ecology?.migrationLabel})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <span className="text-[10px] text-[var(--muted)] block">Habitat Canopy Density</span>
                <span className="font-bold text-[var(--ink)]">
                  {currentBird.ecology?.habitatDensity}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <span className="text-[10px] text-[var(--muted)] block">Global Breeding Range</span>
                <span className="font-bold text-[var(--ink)] font-mono">
                  {currentBird.ecology?.rangeSizeFormatted || currentBird.range}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: TELEMETRY & FLYWAY */}
          {sidebarTab === "telemetry" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[var(--sage)] animate-pulse" />
                    Movebank Tagging
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted)]">
                    {currentBird.telemetry?.points.toLocaleString()} fixes
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-[var(--line)] text-xs">
                  <div>
                    <div className="font-bold text-[var(--ink)] font-mono">
                      {currentBird.telemetry?.individuals || "Sample"}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">Individuals</div>
                  </div>
                  <div>
                    <div className="font-bold text-[var(--sage)]">
                      {currentBird.telemetry?.peakMonth || "Spring"}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">Peak Month</div>
                  </div>
                </div>
              </div>

              {/* 12-Month Seasonal Wave */}
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <div className="text-[10.5px] font-semibold text-[var(--ink)] mb-2">
                  Annual Seasonal Activity (GBIF)
                </div>
                <div className="grid grid-cols-12 gap-0.5 items-end h-14">
                  {(currentBird.telemetry?.monthlyDistribution || [20, 30, 50, 80, 95, 100, 90, 75, 60, 45, 30, 20]).map(
                    (val, idx) => (
                      <div key={idx} className="flex flex-col items-center h-full justify-end">
                        <div
                          style={{ height: `${val}%` }}
                          className={`w-full rounded-t ${
                            months[idx] === currentBird.telemetry?.peakMonth
                              ? "bg-[var(--sage)]"
                              : "bg-[var(--line)]"
                          }`}
                        />
                        <span className="text-[8px] font-mono text-[var(--muted)] mt-1">
                          {months[idx][0]}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <button
                onClick={() => setStageMode("flyway")}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                <span>Open Geospatial Flyway Map</span>
              </button>
            </div>
          )}

          {/* TAB 4: CONSERVATION & STATUS */}
          {sidebarTab === "conservation" && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[var(--muted)]">BirdLife IUCN Status</span>
                  <div className="font-bold text-[var(--ink)] text-sm mt-0.5">
                    {currentBird.conservation?.rlLabel || currentBird.iucnLabel}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-[var(--muted)]">Population Trend</span>
                  <div className="font-bold text-[var(--ink)] flex items-center gap-1 justify-end mt-0.5">
                    {currentBird.conservation?.populationTrend === "Increasing" && (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {currentBird.conservation?.populationTrend === "Decreasing" && (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    {currentBird.conservation?.populationTrend === "Stable" && (
                      <Minus className="w-3.5 h-3.5 text-[var(--sage)]" />
                    )}
                    <span>{currentBird.conservation?.populationTrend || "Stable"}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                <span className="text-[10px] text-[var(--muted)] block mb-1">Estimated Global Population</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {currentBird.conservation?.populationSize || "Monitored across breeding zones"}
                </span>
              </div>

              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {currentBird.description}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Close-Up Lens Button */}
        <button
          onClick={toggleLens}
          className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all cursor-pointer mt-4 ${
            isLensOpen
              ? "bg-[var(--sage-tint)] border-[var(--sage)] text-[var(--ink)]"
              : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--sage)] text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full border border-[var(--sage)]/50 overflow-hidden shrink-0 shadow-sm"
              style={{
                backgroundImage: `url(${currentBird.imageUrl})`,
                backgroundSize: "480%",
                backgroundPosition: currentAsset.lensPosition,
              }}
            />
            <div className="text-left">
              <div className="text-xs font-bold text-[var(--ink)]">Close-up Micro Lens</div>
              <div className="text-[10px] text-[var(--muted)]">
                {isLensOpen ? "Reset stage magnification" : "Inspect feather microstructure"}
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
