/**
 * Typed client for the Bird Atlas API.
 *
 * Every type here mirrors `backend/app/schemas.py`; when a response model
 * changes, change it here too. Image and stream URLs come back relative
 * ("/species/X/image") because the API prefixes them itself — run them through
 * `assetUrl()` before putting them in a src attribute.
 */

const rawBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

/** Both Vite and Vercel forward /api to the Python service. */
export const API_BASE = (rawBase || "/api").replace(/\/+$/, "");

/** Turn an API-relative path into something an <img> or <audio> can load. */
export const assetUrl = (path: string | null | undefined): string => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const responseCache = new Map<string, { until: number; value: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();

function request<T>(path: string, init?: RequestInit): Promise<T> {
  const cacheable = !init?.method || init.method === "GET";
  if (!cacheable) return fetchJson<T>(path, init);
  const cached = responseCache.get(path);
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.value as T);
  const pending = pendingRequests.get(path);
  if (pending) return pending as Promise<T>;
  const promise = fetchJson<T>(path, init).then((value) => {
    if (responseCache.size >= 150) responseCache.delete(responseCache.keys().next().value!);
    responseCache.set(path, { value, until: Date.now() + (path.includes("/status") ? 15000 : 60000) });
    return value;
  }).finally(() => pendingRequests.delete(path));
  pendingRequests.set(path, promise);
  return promise;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response | undefined;
  const attempts = !init?.method || init.method === "GET" ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      response = await fetch(`${API_BASE}${path}`, { ...init, signal: init?.signal ?? AbortSignal.timeout(120000) });
      if (![502, 503, 504].includes(response.status) || attempt === attempts - 1) break;
    } catch {
      if (init?.signal?.aborted || attempt === attempts - 1) {
        throw new ApiError("The bird data service is waking up or temporarily unavailable. Please try again shortly.", 0);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!response) throw new ApiError("The bird data service is temporarily unavailable.", 0);

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail[0]?.msg ?? detail;
    } catch {
      /* non-JSON error body — keep the status line */
    }
    throw new ApiError(detail, response.status);
  }

  return response.json() as Promise<T>;
}

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
};

// ------------------------------------------------------------------- types

export interface Page<T> {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: T[];
}

export interface TaxonomyOut {
  sci_name: string | null;
  primary_com_name: string | null;
  species_code: string | null;
  order_name: string | null;
  family: string | null;
  species_group: string | null;
  category: string | null;
  taxon_order: number | null;
}

export interface SpeciesListItem {
  scientific_name: string;
  common_name: string | null;
  family: string | null;
  order_name: string | null;
  iucn_category: string | null;
  iucn_label: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  known_to_classifier: boolean;
  label_index: number | null;
  mass_g: number | null;
  wing_length_mm: number | null;
  habitat: string | null;
  trophic_niche: string | null;
  primary_lifestyle: string | null;
  migration_label: string | null;
  has_tracking: boolean;
  tracking_points: number;
  has_audio: boolean;
}

export interface TraitOut {
  scientific_name: string;
  family: string | null;
  order_name: string | null;
  mass_g: number | null;
  wing_length_mm: number | null;
  beak_length_culmen_mm: number | null;
  beak_width_mm: number | null;
  beak_depth_mm: number | null;
  tarsus_length_mm: number | null;
  tail_length_mm: number | null;
  hand_wing_index: number | null;
  kipps_distance_mm: number | null;
  habitat: string | null;
  habitat_density: string | null;
  habitat_density_label: string | null;
  migration: string | null;
  migration_label: string | null;
  trophic_level: string | null;
  trophic_niche: string | null;
  primary_lifestyle: string | null;
  min_latitude: number | null;
  max_latitude: number | null;
  centroid_latitude: number | null;
  centroid_longitude: number | null;
  range_size_km2: number | null;
  total_individuals: number | null;
  traits_inferred: string | null;
}

export interface ConservationOut {
  scientific_name: string;
  common_name: string | null;
  family: string | null;
  sis_id: string | null;
  rl_category: string | null;
  rl_aoo: number | null;
  rl_eoo: number | null;
  population_size: string | null;
  population_trend: string | null;
  migratory_status: string | null;
  ecosystem_terrestrial: string | null;
  ecosystem_freshwater: string | null;
  ecosystem_marine: string | null;
  seabird: string | null;
  waterbird: string | null;
  landbird: string | null;
}

export interface ImageOut {
  source: string;
  image_url: string;
  thumbnail_url: string | null;
  original_url: string | null;
  wikipedia_url: string | null;
  attribution: string | null;
  license: string | null;
  width: number | null;
  height: number | null;
  stored_bytes: boolean;
}

export interface SummaryOut {
  title: string | null;
  summary: string | null;
  wikipedia_url: string | null;
  thumbnail_url: string | null;
  source: string;
}

export interface MovementPresence {
  studies: number;
  individuals: number;
  points: number;
  first_timestamp: string | null;
  last_timestamp: string | null;
}

export interface SpeciesDetail {
  scientific_name: string;
  common_name: string | null;
  matched_on: string | null;
  label_indices: number[];
  taxonomy: TaxonomyOut | null;
  traits: TraitOut | null;
  conservation: ConservationOut | null;
  image: ImageOut | null;
  summary: SummaryOut | null;
  tracking: MovementPresence;
  has_traits: boolean;
  has_conservation: boolean;
  has_image: boolean;
  has_summary: boolean;
  known_to_classifier: boolean;
}

export interface FilterOptions {
  orders: string[];
  families: string[];
  iucn_categories: string[];
  total_species: number;
}

export interface SpeciesAudioOut {
  xc_id: number;
  scientific_name: string;
  common_name: string | null;
  recordist: string | null;
  country: string | null;
  locality: string | null;
  sound_type: string | null;
  quality: string | null;
  length: string | null;
  recorded_date: string | null;
  license: string | null;
  stream_url: string;
  page_url: string | null;
  sonogram_url: string | null;
}

export interface SpeciesAudioList {
  scientific_name: string;
  common_name: string | null;
  source: string;
  available: boolean;
  cached: boolean;
  recordings: SpeciesAudioOut[];
}

export interface MigrationCurve {
  common_name: string;
  scientific_name: string | null;
  peak_month: number | null;
  georeferenced_records: number | null;
  top_countries: string[];
  months: number[];
}

export interface StatCard {
  label: string;
  value: string;
  hint: string | null;
  tone: "neutral" | "good" | "warn" | "bad";
}

export interface FactSection {
  title: string;
  body: string;
}

export interface AgentCandidate {
  label_index: number;
  common_name: string;
  scientific_name: string | null;
  confidence: number;
  profile_url: string | null;
  image_url: string | null;
}

export interface VisionVerdict {
  ran: boolean;
  agrees: boolean | null;
  is_bird: boolean | null;
  suggested: string | null;
  note: string | null;
  model: string | null;
  elapsed_ms: number | null;
  error: string | null;
}

export interface SpeciesMedia {
  image_url: string | null;
  thumbnail_url: string | null;
  image_attribution: string | null;
  image_license: string | null;
  audio_stream_url: string | null;
  audio_sonogram_url: string | null;
  audio_note: string | null;
  audio_count: number;
}

export interface SpeciesFacts {
  scientific_name: string;
  common_name: string | null;
  family: string | null;
  order_name: string | null;
  species_code: string | null;
  matched_on: string | null;
  iucn_category: string | null;
  iucn_label: string | null;
  threatened: boolean;
  population_trend: string | null;
  mass_g: number | null;
  wing_length_mm: number | null;
  habitat: string | null;
  trophic_niche: string | null;
  migration_label: string | null;
  primary_lifestyle: string | null;
  range_size_km2: number | null;
  peak_month: string | null;
  top_countries: string | null;
  gbif_records: number | null;
  ebird_observations: number;
  tracking_points: number;
  cards: StatCard[];
  sections: FactSection[];
  media: SpeciesMedia;
  links: Record<string, string>;
  available: Record<string, boolean>;
}

export interface IdentifyAgentResponse {
  common_name: string | null;
  scientific_name: string | null;
  confidence: number;
  uncertain: boolean;
  is_bird: boolean;
  decided_by: "classifier" | "classifier+vision";
  summary: string | null;
  summary_source: "model" | "template" | "none";
  summary_model: string | null;
  facts: SpeciesFacts | null;
  candidates: AgentCandidate[];
  vision: VisionVerdict;
  warnings: string[];
  classifier_model: string | null;
  timings_ms: Record<string, number>;
}

export interface AgentAskResponse {
  scientific_name: string;
  common_name: string | null;
  question: string;
  answer: string;
  source: "model" | "template";
  model: string | null;
  facts: SpeciesFacts;
}

export interface AgentStatus {
  enabled: boolean;
  classifier_loaded: boolean;
  classifier_model: string | null;
  text_models: string[];
  vision_model: string | null;
  vision_enabled: boolean;
  vision_threshold: number;
  google_key: boolean;
  groq_key: boolean;
  summary_fallback: string;
}

// --------------------------------------------------------------- tracking

export interface TrackedSpecies {
  scientific_name: string | null;
  common_name: string | null;
  studies: number;
  individuals: number;
  points: number;
  first_timestamp: string | null;
  last_timestamp: string | null;
  sources: string[];
}

export interface StudyOut {
  study_id: string;
  name: string | null;
  species: string | null;
  license_type: string | null;
  citation: string | null;
  acknowledgements: string | null;
  principal_investigator: string | null;
  number_of_individuals: number | null;
  number_of_deployments: number | null;
}

export interface LineStringFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: {
    individual: string | null;
    points: number;
    start: string | null;
    end: string | null;
    source: string | null;
    study_id: string | null;
    timestamps: string[];
    individual_id: number | null;
  };
}

export interface CommonsAudioList {
  scientific_name: string;
  recordings: { title: string; url: string; page_url: string; recordist: string; license: string; license_url: string; size: number }[];
}
export const getCommonsAudio = (name: string) =>
  request<CommonsAudioList>(`/species/${encodeURIComponent(name)}/audio/commons`);

export interface TrackResponse {
  species: string | null;
  individual: string | null;
  resolution: "daily" | "weekly" | "monthly";
  points: number;
  individuals: number;
  geojson: { type: "FeatureCollection"; features: LineStringFeature[] };
  studies: StudyOut[];
}

export interface TrackBounds {
  south: number | null;
  north: number | null;
  west: number | null;
  east: number | null;
  first_ts: string | null;
  last_ts: string | null;
}

export const getTrackedSpecies = () => request<TrackedSpecies[]>("/tracking/species");

export const getSpeciesTracks = (
  name: string,
  resolution: "daily" | "weekly" | "monthly" = "monthly"
) =>
  request<TrackResponse>(
    `/tracking/species/${encodeURIComponent(name)}/tracks${query({ resolution })}`
  );

export const getTrackBounds = () => request<TrackBounds>("/tracking/bounds");

// ------------------------------------------------------------- catalogue

export interface TableCount {
  table: string;
  rows: number;
  label: string;
  description: string;
  source: string;
  license: string | null;
}

export interface StatsResponse {
  tables: number;
  total_rows: number;
  db_size_mb: number;
  counts: TableCount[];
}

export const getStats = () => request<StatsResponse>("/stats");

// --------------------------------------------------------------- phylogeny

export interface PhylogenyNode {
  name: string;
  is_family: boolean;
  children: PhylogenyNode[];
}

export interface PhylogenyFamily {
  name: string;
  parent_name: string | null;
  is_family: boolean;
}

/** Whole BirdLife family tree, already nested: 483 nodes, 243 named families. */
export const getPhylogenyTree = () => request<PhylogenyNode[]>("/phylogeny/tree");

export const getPhylogenyFamilies = () =>
  request<PhylogenyFamily[]>("/phylogeny/families");

/** The separate Hackett Stage-1 species tree — a flat list of 6,670 tips. */
export const getPhylogenySpecies = (pageSize = 1) =>
  request<Page<string>>(`/phylogeny/species${query({ page_size: pageSize })}`);

// --------------------------------------------------------------- endpoints

export interface SpeciesQuery {
  names?: string;
  page?: number;
  page_size?: number;
  order?: string;
  family?: string;
  iucn?: string;
  has_image?: boolean;
  has_tracks?: boolean;
  q?: string;
  sort?: "taxonomic" | "name" | "family";
}

export const listSpecies = (params: SpeciesQuery = {}) =>
  request<Page<SpeciesListItem>>(`/species${query({ ...params })}`);

export const searchSpecies = (q: string, pageSize = 12) =>
  request<Page<SpeciesListItem>>(`/species/search${query({ q, page_size: pageSize })}`);

export const getFilters = () => request<FilterOptions>("/species/filters");

export const getSpecies = (name: string) =>
  request<SpeciesDetail>(`/species/${encodeURIComponent(name)}`);

export const getSpeciesAudio = (name: string, limit = 5) =>
  request<SpeciesAudioList>(`/species/${encodeURIComponent(name)}/audio${query({ limit })}`);

export const getMigration = (name: string) =>
  request<MigrationCurve>(`/species/${encodeURIComponent(name)}/migration`);

export const agentStatus = () => request<AgentStatus>("/agent/status");

export const agentIdentify = (file: File, verify: "auto" | "always" | "never" = "auto") => {
  const form = new FormData();
  form.append("file", file);
  return request<IdentifyAgentResponse>(`/agent/identify${query({ verify })}`, {
    method: "POST",
    body: form,
  });
};

export const agentAsk = (name: string, question: string) =>
  request<AgentAskResponse>("/agent/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, question }),
  });

export const agentDescribe = (name: string) =>
  request<IdentifyAgentResponse>(`/agent/species/${encodeURIComponent(name)}`);
