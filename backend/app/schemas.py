"""Response models for the API.

Every model here describes what a client receives, never what the database
holds — so columns that are internal join keys or raw codes are dropped, and
1/2/3 code columns are accompanied by their decoded label.

Pagination is the same envelope Rayquaza uses, `{total, page, page_size, items}`,
so a paginated endpoint always has the same shape.
"""

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

# ---------------------------------------------------------------- generic


class Page(BaseModel, Generic[T]):
    """Envelope for every paginated list endpoint.

    Generic so that `Page[SpeciesListItem]` is what lands in the OpenAPI schema —
    a client generator can then see the shape of `items`. A plain `list[Any]`
    would come through as an untyped array and defeat the generated types.
    """

    total: int
    page: int
    page_size: int
    pages: int
    items: list[T]


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[GeoJSONFeature]


# ---------------------------------------------------------------- species


class SpeciesListItem(BaseModel):
    """One row of the browse/search list. Deliberately lean — the detail
    endpoint carries the full profile."""

    scientific_name: str
    common_name: str | None = None
    family: str | None = None
    order_name: str | None = None
    iucn_category: str | None = None
    iucn_label: str | None = None
    image_url: str | None = None
    image_thumbnail_url: str | None = None
    known_to_classifier: bool = False
    label_index: int | None = None

    # Key ecological & morphological telemetry from AVONET & BirdLife
    mass_g: float | None = None
    wing_length_mm: float | None = None
    habitat: str | None = None
    trophic_niche: str | None = None
    primary_lifestyle: str | None = None
    migration_label: str | None = None
    has_tracking: bool = False
    tracking_points: int = 0
    has_audio: bool = False


class TaxonomyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sci_name: str | None
    primary_com_name: str | None
    species_code: str | None
    order_name: str | None
    family: str | None
    species_group: str | None
    category: str | None
    taxon_order: float | None


class TraitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scientific_name: str
    family: str | None
    order_name: str | None

    mass_g: float | None
    wing_length_mm: float | None
    beak_length_culmen_mm: float | None
    beak_width_mm: float | None
    beak_depth_mm: float | None
    tarsus_length_mm: float | None
    tail_length_mm: float | None
    hand_wing_index: float | None
    kipps_distance_mm: float | None

    habitat: str | None
    habitat_density: str | None
    habitat_density_label: str | None = None
    migration: str | None
    migration_label: str | None = None
    trophic_level: str | None
    trophic_niche: str | None
    primary_lifestyle: str | None

    min_latitude: float | None
    max_latitude: float | None
    centroid_latitude: float | None
    centroid_longitude: float | None
    range_size_km2: float | None

    total_individuals: int | None
    traits_inferred: str | None


class ConservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scientific_name: str
    common_name: str | None
    family: str | None
    sis_id: str | None

    rl_category: str | None
    rl_aoo: float | None
    rl_eoo: float | None
    population_size: str | None
    population_trend: str | None
    migratory_status: str | None

    ecosystem_terrestrial: str | None
    ecosystem_freshwater: str | None
    ecosystem_marine: str | None
    seabird: str | None
    waterbird: str | None
    landbird: str | None


class ImageOut(BaseModel):
    """One representative picture.

    `image_url` always points at this API, so the frontend can drop it straight
    into an <img> without caring whether the bytes live in the database or on
    Wikipedia's CDN. The raw urls are still exposed for attribution.
    """

    source: str
    image_url: str
    thumbnail_url: str | None = None
    original_url: str | None = None
    wikipedia_url: str | None = None
    attribution: str | None = None
    license: str | None = None
    width: int | None = None
    height: int | None = None
    stored_bytes: bool = False


class CommonsAudioRecording(BaseModel):
    title: str
    url: str
    page_url: str
    recordist: str
    license: str
    license_url: str
    size: int


class CommonsAudioList(BaseModel):
    scientific_name: str
    recordings: list[CommonsAudioRecording]


class SpeciesAudioOut(BaseModel):
    """One Xeno-canto recording.

    `stream_url` is an endpoint on this API that proxies the audio, so the
    frontend can use it as an <audio src> without knowing anything about
    Xeno-canto's URLs or headers. `page_url` is there for attribution, and
    `sonogram_url` for drawing the spectrogram image.
    """

    xc_id: int
    scientific_name: str
    common_name: str | None = None
    recordist: str | None = None
    country: str | None = None
    locality: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    sound_type: str | None = None
    sex: str | None = None
    stage: str | None = None
    quality: str | None = None
    format: str | None = None
    length: str | None = None
    recorded_date: str | None = None
    license: str | None = None
    remarks: str | None = None
    stream_url: str
    page_url: str | None = None
    sonogram_url: str | None = None


class SpeciesAudioList(BaseModel):
    """Every recording held for one species.

    `available` is false when the archive holds nothing for the species — a
    normal result, not an error. Roughly a few hundred of the world's birds
    have no recording yet, and some groups (nightbirds, pelagic species) are
    thinner than the rest, so the frontend should render this state rather
    than assume a player.
    """

    scientific_name: str
    common_name: str | None = None
    source: str = "Xeno-canto"
    available: bool = False
    cached: bool = False
    recordings: list[SpeciesAudioOut] = Field(default_factory=list)


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str | None
    summary: str | None
    wikipedia_url: str | None
    thumbnail_url: str | None
    source: str


class MovementPresence(BaseModel):
    """Whether we hold tracking data for this species — lets the UI decide
    whether to show the migration tab without a second request."""

    studies: int = 0
    individuals: int = 0
    points: int = 0
    first_timestamp: str | None = None
    last_timestamp: str | None = None


class SpeciesDetail(BaseModel):
    """The live join across every source that knows this species.

    Blocks are null when no source covers the species, which is normal: the
    trait set covers ~11,000 species, the classifier only 526, and tracking
    only the 44 that have been tagged.
    """

    scientific_name: str
    common_name: str | None = None
    matched_on: str | None = None
    label_indices: list[int] = Field(default_factory=list)

    taxonomy: TaxonomyOut | None = None
    traits: TraitOut | None = None
    conservation: ConservationOut | None = None
    image: ImageOut | None = None
    summary: SummaryOut | None = None
    tracking: MovementPresence

    has_traits: bool = False
    has_conservation: bool = False
    has_image: bool = False
    has_summary: bool = False
    known_to_classifier: bool = False


class FilterOptions(BaseModel):
    """Vocabulary for the frontend's filter controls."""

    orders: list[str]
    families: list[str]
    iucn_categories: list[str]
    total_species: int


# ---------------------------------------------------------------- occurrence


class MigrationCurve(BaseModel):
    """A species' year in one object: twelve monthly counts, chart-ready."""

    common_name: str
    scientific_name: str | None = None
    gbif_key: str | None = None
    peak_month: int | None = None
    georeferenced_records: int | None = None
    top_countries: list[str] = Field(default_factory=list)
    months: list[int] = Field(default_factory=list)


class GbifPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    common_name: str
    scientific_name: str | None
    month: int | None
    year: int | None
    latitude: float | None
    longitude: float | None
    country: str | None
    country_code: str | None
    basis_of_record: str | None


class EbirdSampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    region_code: str
    region_name: str | None
    year: int
    month: int
    species_code: str | None
    common_name: str | None
    scientific_name: str | None
    observation_count: int | None
    is_target: int
    region_total_records: int | None


class EbirdRegion(BaseModel):
    region_code: str
    region_name: str | None = None
    species_reported: int
    months_covered: list[int] = Field(default_factory=list)


class EbirdTimeline(BaseModel):
    """One species across every sampled region-month.

    The frontend's seasonal heatmap: rows are regions, columns are months,
    cells are whether the species was reported.
    """

    scientific_name: str | None = None
    common_name: str | None = None
    year: int
    months: list[int]
    regions: list[dict[str, Any]]


class HotspotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    region_code: str
    loc_id: str | None
    name: str | None
    latitude: float | None
    longitude: float | None
    latest_obs_dt: str | None
    num_species_all_time: int | None


class ObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    common_name: str | None
    scientific_name: str | None
    observation_count: str | None
    observation_date: str | None
    county: str | None
    locality: str | None
    latitude: float | None
    longitude: float | None
    protocol_name: str | None
    duration_minutes: float | None
    effort_distance_km: float | None


# ---------------------------------------------------------------- tracking


class StudyOut(BaseModel):
    """A Movebank study. Citation and licence travel with every track response
    because Movebank requires attribution for CC BY / CC BY-NC data."""

    model_config = ConfigDict(from_attributes=True)

    study_id: str
    name: str | None = None
    species: str | None = None
    license_type: str | None = None
    citation: str | None = None
    acknowledgements: str | None = None
    principal_investigator: str | None = None
    number_of_individuals: int | None = None
    number_of_deployments: int | None = None
    sensor_type_ids: str | None = None
    url: str | None = None
    individuals_loaded: int = 0
    points_loaded: int = 0


class IndividualOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str | None
    study_id: str | None
    animal_id: str | None
    animal_taxon: str | None
    animal_sex: str | None
    animal_life_stage: str | None
    tag_model: str | None
    tag_manufacturer_name: str | None
    attachment_type: str | None
    deploy_on_date: str | None
    deploy_off_date: str | None
    deployment_end_type: str | None
    study_site: str | None


class TrackedSpecies(BaseModel):
    """A species we hold telemetry for, plus how much of it."""

    scientific_name: str | None = None
    common_name: str | None = None
    studies: int = 0
    individuals: int = 0
    points: int = 0
    first_timestamp: str | None = None
    last_timestamp: str | None = None
    sources: list[str] = Field(default_factory=list)


class TrackResponse(BaseModel):
    """Tracks as GeoJSON, plus the attribution the data licence requires."""

    species: str | None = None
    individual: str | None = None
    resolution: str = "daily"
    points: int = 0
    individuals: int = 0
    geojson: GeoJSONFeatureCollection
    studies: list[StudyOut] = Field(default_factory=list)


class TrackBounds(BaseModel):
    """Extent of all telemetry — the initial view for a world map."""

    south: float | None = None
    north: float | None = None
    west: float | None = None
    east: float | None = None
    first_ts: str | None = None
    last_ts: str | None = None


# ---------------------------------------------------------------- taxonomy


class OrderNode(BaseModel):
    order_name: str
    species_count: int
    families: list[str] = Field(default_factory=list)


class FamilyNode(BaseModel):
    family: str
    species_count: int
    order_name: str | None = None


class PhylogenyNode(BaseModel):
    """One node of the BirdLife family tree. Children are nested so the frontend
    can render the tree without a second pass."""

    name: str
    is_family: bool
    children: list["PhylogenyNode"] = Field(default_factory=list)


class TreeMembership(BaseModel):
    """Whether a species is a tip of the Hackett tree — the frontend's cue to
    offer a phylogeny tab. A 404 means no."""

    scientific_name: str
    in_tree: bool = True


# ---------------------------------------------------------------- geo


class RichnessCellOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    world_id: int
    total_richness: int | None
    sampled_richness: int | None
    unsampled_richness: int | None
    latitude: float | None = None
    longitude: float | None = None
    country: str | None = None


class CountryRichness(BaseModel):
    """Species richness rolled up to a country."""

    country: str
    cells: int
    mean_richness: float
    max_richness: int | None = None
    total_richness: int | None = None


class RichnessSummary(BaseModel):
    cells: int
    cells_with_location: int = 0
    max_total_richness: int | None = None
    min_total_richness: int | None = None
    mean_total_richness: float | None = None
    histogram: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------- classify


class Prediction(BaseModel):
    label_index: int
    common_name: str
    confidence: float
    scientific_name: str | None = None
    family: str | None = None
    iucn_category: str | None = None
    profile_url: str | None = None
    image_url: str | None = None


class IdentifyResponse(BaseModel):
    model: str
    inference_ms: float
    image_width: int | None = None
    image_height: int | None = None
    predictions: list[Prediction]


class ClassifierClass(BaseModel):
    label_index: int
    common_name: str
    scientific_name: str | None = None
    family: str | None = None


# ---------------------------------------------------------------- meta


class TableCount(BaseModel):
    table: str
    rows: int
    label: str
    description: str
    source: str
    license: str | None = None


class HealthResponse(BaseModel):
    status: str
    database: str | None = None
    database_ok: bool = False
    model_loaded: bool = False
    classifier: str | None = None
    tables: int | None = None


class TaxonomyCategory(BaseModel):
    """One row category of the eBird backbone — species, subspecies, hybrid…"""

    category: str | None = None
    rows: int


class PhylogenyFamilyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    parent_name: str | None = None
    is_family: bool = False


class SampledConditions(BaseModel):
    """What the occurrence tables actually cover, for labelling charts."""

    gbif_points: int = 0
    gbif_species: int = 0
    gbif_curves: int = 0
    ebird_samples: int = 0
    ebird_regions: int = 0
    ebird_year_min: int | None = None
    ebird_year_max: int | None = None
    hotspots: int = 0
    observations: int = 0


class DataNote(BaseModel):
    table: str
    label: str
    description: str
    source: str
    license: str | None = None


class CoverageResponse(BaseModel):
    """Provenance for every table, for the frontend's "about the data" page."""

    tables: list[DataNote]
    notes: list[str]


class StatsResponse(BaseModel):
    tables: int
    total_rows: int
    db_size_mb: float
    counts: list[TableCount]


class ServiceInfo(BaseModel):
    status: str
    service: str
    docs: str
    domains: list[str]


# ---------------------------------------------------------------- agent


class StatCard(BaseModel):
    """One stat tile, ready to render. `tone` is a colour hint, not data."""

    label: str
    value: str
    hint: str | None = None
    tone: Literal["neutral", "good", "warn", "bad"] = "neutral"


class FactSection(BaseModel):
    title: str
    body: str


class AgentCandidate(BaseModel):
    """One of the classifier's ranked guesses."""

    label_index: int
    common_name: str
    scientific_name: str | None = None
    confidence: float
    profile_url: str | None = None
    image_url: str | None = None


class VisionVerdict(BaseModel):
    """The vision model's second opinion, when one was asked for."""

    ran: bool = Field(description="False when the classifier was confident enough")
    agrees: bool | None = Field(None, description="Did it back one of the candidates")
    is_bird: bool | None = Field(None, description="False when it sees no bird at all")
    suggested: str | None = Field(None, description="Its own identification, if it disagreed")
    note: str | None = Field(None, description="One sentence of its reasoning")
    model: str | None = None
    elapsed_ms: float | None = None
    error: str | None = Field(None, description="Set when the cross-check itself failed")


class SpeciesMedia(BaseModel):
    image_url: str | None = None
    thumbnail_url: str | None = None
    image_attribution: str | None = None
    image_license: str | None = None
    audio_stream_url: str | None = Field(
        None, description="Plays a cached Xeno-canto recording through this API"
    )
    audio_sonogram_url: str | None = None
    audio_note: str | None = Field(None, description="Sound type, country and length")
    audio_count: int = 0


class SpeciesFacts(BaseModel):
    """The database's answer for one species, display-ready."""

    scientific_name: str
    common_name: str | None = None
    family: str | None = None
    order_name: str | None = None
    species_code: str | None = None
    matched_on: str | None = Field(None, description="Which name set the match came from")

    iucn_category: str | None = None
    iucn_label: str | None = None
    threatened: bool = False
    population_trend: str | None = None

    mass_g: float | None = None
    wing_length_mm: float | None = None
    habitat: str | None = None
    trophic_niche: str | None = None
    migration_label: str | None = None
    primary_lifestyle: str | None = None
    range_size_km2: float | None = None

    peak_month: str | None = None
    top_countries: str | None = None
    gbif_records: int | None = None
    ebird_observations: int = 0
    tracking_points: int = 0

    cards: list[StatCard] = []
    sections: list[FactSection] = []
    media: SpeciesMedia = SpeciesMedia()
    links: dict[str, str] = {}
    available: dict[str, bool] = Field(
        default_factory=dict, description="Which data sources had a row for this species"
    )


class IdentifyAgentResponse(BaseModel):
    """What the agent returns for one uploaded photo."""

    common_name: str | None = None
    scientific_name: str | None = None
    confidence: float = Field(description="The classifier's top-1 probability")
    uncertain: bool = Field(description="True when the answer deserves a caveat in the UI")
    is_bird: bool = Field(True, description="False only when the vision model saw no bird")
    decided_by: Literal["classifier", "classifier+vision"] = "classifier"

    summary: str | None = Field(None, description="The paragraph to show the user")
    summary_source: Literal["model", "template", "none"] = "none"
    summary_model: str | None = None

    facts: SpeciesFacts | None = None
    candidates: list[AgentCandidate] = []
    vision: VisionVerdict
    warnings: list[str] = Field(
        default_factory=list, description="Caveats worth showing the user verbatim"
    )
    classifier_model: str | None = None
    timings_ms: dict[str, float] = {}


class AgentAskResponse(BaseModel):
    """A grounded answer to one question about one species."""

    scientific_name: str
    common_name: str | None = None
    question: str
    answer: str
    source: Literal["model", "template"] = "model"
    model: str | None = None
    facts: SpeciesFacts


class AgentStatus(BaseModel):
    """What the agent can do right now, without making an API call."""

    enabled: bool = Field(description="Is any text model reachable")
    classifier_loaded: bool
    classifier_model: str | None = None
    text_models: list[str] = Field(description="The fallback chain, in order")
    vision_model: str | None = None
    vision_enabled: bool
    vision_threshold: float = Field(description="Top-1 confidence below which vision is consulted")
    google_key: bool
    groq_key: bool
    summary_fallback: str = "template"


PhylogenyNode.model_rebuild()
