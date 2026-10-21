/**
 * Maps the API's species shapes onto the `BirdSpecies` view model the existing
 * cards and modal already render.
 *
 * The list endpoint is deliberately lean — it carries no beak or hand-wing
 * measurements, no summary and no monthly curve. `fromListItem` therefore
 * fills honest defaults ("—", zeros) rather than inventing numbers, and
 * `BirdDetailModal` calls `applyDetail` once to replace them with the real
 * joined record.
 */

import type { BirdSpecies } from "../data/mockBirds";
import { CONSERVATION_LABELS, type ConservationCode } from "./conservation";
import { SKETCHFAB_BY_SPECIES } from "../data/birdModels";
import {
  assetUrl,
  type ConservationOut,
  type ImageOut,
  type SpeciesAudioList,
  type SpeciesDetail,
  type SpeciesListItem,
  type TraitOut,
} from "./api";

const asIucn = (code: string | null | undefined): ConservationCode => {
  const value = (code ?? "").toUpperCase();
  return value in CONSERVATION_LABELS ? value as ConservationCode : "NE";
};

const DASH = "—";

const fmtMass = (grams: number | null | undefined): string => {
  if (grams == null) return DASH;
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams >= 10000 ? 0 : 1)} kg`;
  return `${grams < 10 ? grams.toFixed(1) : Math.round(grams)} g`;
};

/** AVONET records wing chord, not wingspan — label it as what it is. */
const fmtWing = (mm: number | null | undefined): string =>
  mm == null ? DASH : `${Math.round(mm)} mm`;

const fmtRange = (km2: number | null | undefined): string => {
  if (km2 == null) return DASH;
  if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(1)}M km²`;
  if (km2 >= 1_000) return `${Math.round(km2 / 1000).toLocaleString()}k km²`;
  return `${Math.round(km2).toLocaleString()} km²`;
};

/** Title-case the AVONET snake_case vocabulary ("insessorial" → "Insessorial"). */
const humanise = (value: string | null | undefined): string => {
  if (!value) return DASH;
  const clean = value.replace(/_/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const thresholdThreatened = (code: string | null | undefined) =>
  ["VU", "EN", "CR"].includes((code ?? "").toUpperCase());

const emptySpecies = (list: SpeciesListItem): BirdSpecies => {
  const common = list.common_name || list.scientific_name;
  return {
    id: list.scientific_name,
    name: common,
    commonName: common,
    scientificName: list.scientific_name,
    family: list.family || DASH,
    order: list.order_name || DASH,
    sublabel: [list.family, list.habitat || list.primary_lifestyle]
      .filter(Boolean)
      .join(" · "),
    iucnCategory: asIucn(list.iucn_category),
    iucnLabel: list.iucn_label || list.iucn_category || "Not assessed",
    imageUrl: assetUrl(list.image_url),
    thumbnailUrl: list.image_url ? assetUrl(list.image_url) : undefined,
    description: "",
    habitat: list.habitat || DASH,
    diet: list.trophic_niche || DASH,
    lengthCm: DASH,
    wingspanCm: fmtWing(list.wing_length_mm),
    massG: fmtMass(list.mass_g),
    range: DASH,
    tags: [
      list.known_to_classifier ? "Classifier known" : "",
      list.has_tracking ? "GPS tracked" : "",
      list.has_audio ? "Recorded" : "",
    ].filter(Boolean),
    has3dModel: SKETCHFAB_BY_SPECIES.has(list.scientific_name) || ["Alcedo atthis", "Upupa epops"].includes(list.scientific_name),
    featured: list.known_to_classifier && list.has_tracking,
    soundDescription: list.has_audio ? "Archived recording available" : undefined,
    morphometrics: {
      massG: list.mass_g ?? 0,
      massFormatted: fmtMass(list.mass_g),
      wingLengthMm: list.wing_length_mm ?? 0,
      wingspanCm: fmtWing(list.wing_length_mm),
      beakLengthCulmenMm: 0,
      beakWidthMm: 0,
      beakDepthMm: 0,
      tarsusLengthMm: 0,
      tailLengthMm: 0,
      handWingIndex: 0,
      kippsDistanceMm: 0,
    },
    ecology: {
      habitat: list.habitat || DASH,
      habitatDensity: DASH,
      migrationLabel: humanise(list.migration_label),
      trophicLevel: DASH,
      trophicNiche: list.trophic_niche || DASH,
      primaryLifestyle: humanise(list.primary_lifestyle),
      rangeSizeKm2: 0,
      rangeSizeFormatted: DASH,
      ecosystems: { terrestrial: false, freshwater: false, marine: false },
    },
    conservation: {
      rlCategory: asIucn(list.iucn_category),
      rlLabel: list.iucn_label || "Not assessed",
      populationTrend: "Unknown",
      populationSize: undefined,
      threatened: thresholdThreatened(list.iucn_category),
    },
    telemetry: {
      hasTracking: list.has_tracking,
      points: list.tracking_points,
      individuals: 0,
      studies: 0,
      peakMonth: undefined,
      topCountries: undefined,
      monthlyDistribution: undefined,
    },
    audio: {
      hasAudio: list.has_audio,
      recordingCount: 0,
      primarySoundType: "Call",
      soundDescription: list.has_audio
        ? "Recording held in the Xeno-canto archive."
        : "No recording held for this species.",
      recordist: undefined,
    },
  };
};

export const fromListItem = (list: SpeciesListItem): BirdSpecies => emptySpecies(list);

const applyTraits = (bird: BirdSpecies, traits: TraitOut | null) => {
  if (!traits) return;
  bird.morphometrics = {
    massG: traits.mass_g ?? 0,
    massFormatted: fmtMass(traits.mass_g),
    wingLengthMm: traits.wing_length_mm ?? 0,
    wingspanCm: fmtWing(traits.wing_length_mm),
    beakLengthCulmenMm: traits.beak_length_culmen_mm ?? 0,
    beakWidthMm: traits.beak_width_mm ?? 0,
    beakDepthMm: traits.beak_depth_mm ?? 0,
    tarsusLengthMm: traits.tarsus_length_mm ?? 0,
    tailLengthMm: traits.tail_length_mm ?? 0,
    handWingIndex: traits.hand_wing_index ?? 0,
    kippsDistanceMm: traits.kipps_distance_mm ?? 0,
  };
  bird.massG = fmtMass(traits.mass_g);
  bird.wingspanCm = fmtWing(traits.wing_length_mm);
  bird.habitat = traits.habitat || DASH;
  bird.ecology = {
    ...bird.ecology,
    habitat: traits.habitat || DASH,
    habitatDensity: humanise(traits.habitat_density_label || traits.habitat_density),
    migrationLabel: humanise(traits.migration_label || traits.migration),
    trophicLevel: humanise(traits.trophic_level),
    trophicNiche: humanise(traits.trophic_niche),
    primaryLifestyle: humanise(traits.primary_lifestyle),
    rangeSizeKm2: traits.range_size_km2 ?? 0,
    rangeSizeFormatted: fmtRange(traits.range_size_km2),
  };
  bird.diet = traits.trophic_niche ? humanise(traits.trophic_niche) : bird.diet;
  bird.range = fmtRange(traits.range_size_km2);
};

const applyConservation = (bird: BirdSpecies, cons: ConservationOut | null) => {
  if (!cons) return;
  const trend = (cons.population_trend || "").toLowerCase();
  const mapped =
    trend.includes("increas") ? "Increasing"
    : trend.includes("decreas") ? "Decreasing"
    : trend.includes("stable") ? "Stable"
    : "Unknown";
  bird.conservation = {
    rlCategory: asIucn(cons.rl_category),
    rlLabel: bird.iucnLabel,
    populationTrend: mapped as BirdSpecies["conservation"]["populationTrend"],
    populationSize: cons.population_size || undefined,
    threatened: thresholdThreatened(cons.rl_category),
  };
  bird.iucnCategory = asIucn(cons.rl_category);
  bird.ecology.ecosystems = {
    terrestrial: (cons.ecosystem_terrestrial || "").toLowerCase() === "true",
    freshwater: (cons.ecosystem_freshwater || "").toLowerCase() === "true",
    marine: (cons.ecosystem_marine || "").toLowerCase() === "true",
  };
};

const applyImage = (bird: BirdSpecies, image: ImageOut | null) => {
  if (!image) return;
  bird.imageUrl = assetUrl(image.image_url);
  bird.thumbnailUrl = assetUrl(image.image_url);
};

/** Merge the full record into a list-derived card. Mutates and returns it. */
export const applyDetail = (bird: BirdSpecies, detail: SpeciesDetail): BirdSpecies => {
  const next = { ...bird };

  next.scientificName = detail.scientific_name;
  next.commonName = detail.common_name || detail.scientific_name;
  next.name = next.commonName;
  next.family = detail.taxonomy?.family || bird.family;
  next.order = detail.taxonomy?.order_name || bird.order;
  next.tags = [
    detail.known_to_classifier ? "Classifier known" : "",
    next.telemetry.hasTracking ? "GPS tracked" : "",
    next.audio.hasAudio ? "Recorded" : "",
  ].filter(Boolean);

  applyTraits(next, detail.traits);
  applyConservation(next, detail.conservation);
  applyImage(next, detail.image);

  if (detail.summary?.summary) {
    next.description = detail.summary.summary;
  }

  next.sublabel = [next.family, next.ecology.habitat || next.ecology.primaryLifestyle]
    .filter(Boolean)
    .join(" · ");

  next.telemetry = {
    ...next.telemetry,
    hasTracking: detail.tracking.individuals > 0 || detail.tracking.points > 0,
    points: detail.tracking.points,
    individuals: detail.tracking.individuals,
    studies: detail.tracking.studies,
    firstTimestamp: detail.tracking.first_timestamp ?? undefined,
    lastTimestamp: detail.tracking.last_timestamp ?? undefined,
  };

  return next;
};

export const applyAudio = (bird: BirdSpecies, audio: SpeciesAudioList): BirdSpecies => {
  const first = audio.recordings[0];
  return {
    ...bird,
    audio: {
      hasAudio: audio.available,
      recordingCount: audio.recordings.length,
      primarySoundType: first?.sound_type ? humanise(first.sound_type) : "Call",
      soundDescription: first
        ? [humanise(first.sound_type), first.country, first.length]
            .filter(Boolean)
            .join(" · ")
        : "No recording held for this species.",
      recordist: first?.recordist
        ? `${first.recordist}${first.recorded_date ? ` · ${first.recorded_date}` : ""}`
        : undefined,
    },
  };
};
