"""SQLAlchemy models for every bird dataset in this project.

Each source keeps its own table so imports stay independent and re-runnable.
Names are mapped to snake_case; the original column names from each source are
kept in the ingest modules, not here.
"""

from sqlalchemy import Float, ForeignKey, Index, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# ---------------------------------------------------------------- image classes


class Species(Base):
    """The 526 class slots of the 525-species image dataset.

    scientific_name / family / order are resolved by name matching against the
    eBird and BirdLife tables during ingestion, and are null when no confident
    match exists.
    """

    __tablename__ = "species"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label_index: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    scientific_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    family: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    order_name: Mapped[str | None] = mapped_column(String, nullable=True)
    match_source: Mapped[str | None] = mapped_column(String, nullable=True)


# ---------------------------------------------------------------- global traits


class Trait(Base):
    """AVONET: morphology, ecology and range data for ~11,000 species."""

    __tablename__ = "traits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scientific_name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    family: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    order_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    avibase_id: Mapped[str | None] = mapped_column(String, nullable=True)

    total_individuals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    female: Mapped[int | None] = mapped_column(Integer, nullable=True)
    male: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unknown_sex: Mapped[int | None] = mapped_column(Integer, nullable=True)
    complete_measures: Mapped[int | None] = mapped_column(Integer, nullable=True)

    beak_length_culmen_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    beak_length_nares_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    beak_width_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    beak_depth_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    tarsus_length_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    wing_length_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    kipps_distance_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    secondary1_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    hand_wing_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    tail_length_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    mass_g: Mapped[float | None] = mapped_column(Float, nullable=True)

    mass_source: Mapped[str | None] = mapped_column(String, nullable=True)
    inference: Mapped[str | None] = mapped_column(String, nullable=True)
    traits_inferred: Mapped[str | None] = mapped_column(String, nullable=True)
    reference_species: Mapped[str | None] = mapped_column(String, nullable=True)

    habitat: Mapped[str | None] = mapped_column(String, nullable=True)
    habitat_density: Mapped[str | None] = mapped_column(String, nullable=True)
    migration: Mapped[str | None] = mapped_column(String, nullable=True)
    trophic_level: Mapped[str | None] = mapped_column(String, nullable=True)
    trophic_niche: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_lifestyle: Mapped[str | None] = mapped_column(String, nullable=True)

    min_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    centroid_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    centroid_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    range_size_km2: Mapped[float | None] = mapped_column(Float, nullable=True)

    # AVONET stores these as 1/2/3 codes; decoded per the dataset's own
    # variable description in Supplementary dataset 1.
    @property
    def migration_label(self) -> str | None:
        return {
            "1": "Sedentary",
            "2": "Partially migratory",
            "3": "Migratory (long-distance)",
        }.get((self.migration or "").strip())

    @property
    def habitat_density_label(self) -> str | None:
        return {
            "1": "Dense habitats",
            "2": "Semi-open habitats",
            "3": "Open habitats",
        }.get((self.habitat_density or "").strip())


# ---------------------------------------------------------------- conservation


class Conservation(Base):
    """BirdLife International species export: IUCN status, population, range."""

    __tablename__ = "conservation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sis_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    sequence: Mapped[str | None] = mapped_column(String, nullable=True)
    family: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    scientific_name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    common_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)

    rl_category: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    pe: Mapped[str | None] = mapped_column(String, nullable=True)
    pew: Mapped[str | None] = mapped_column(String, nullable=True)
    seabird: Mapped[str | None] = mapped_column(String, nullable=True)
    waterbird: Mapped[str | None] = mapped_column(String, nullable=True)
    landbird: Mapped[str | None] = mapped_column(String, nullable=True)
    migratory_status: Mapped[str | None] = mapped_column(String, index=True, nullable=True)

    ecosystem_terrestrial: Mapped[str | None] = mapped_column(String, nullable=True)
    ecosystem_freshwater: Mapped[str | None] = mapped_column(String, nullable=True)
    ecosystem_marine: Mapped[str | None] = mapped_column(String, nullable=True)

    rl_aoo: Mapped[float | None] = mapped_column(Float, nullable=True)
    rl_eoo: Mapped[float | None] = mapped_column(Float, nullable=True)
    population_size: Mapped[str | None] = mapped_column(String, nullable=True)
    population_size_derivation: Mapped[str | None] = mapped_column(String, nullable=True)
    population_trend: Mapped[str | None] = mapped_column(String, nullable=True)
    population_trend_derivation: Mapped[str | None] = mapped_column(String, nullable=True)


# ---------------------------------------------------------------- taxonomy


class Taxonomy(Base):
    """eBird Taxonomy v2021 - the name backbone used for code lookups."""

    __tablename__ = "taxonomy"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    taxon_order: Mapped[float | None] = mapped_column(Float, index=True, nullable=True)
    category: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    species_code: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    primary_com_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    sci_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    order_name: Mapped[str | None] = mapped_column(String, nullable=True)
    family: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    species_group: Mapped[str | None] = mapped_column(String, nullable=True)
    report_as: Mapped[str | None] = mapped_column(String, nullable=True)


# ---------------------------------------------------------------- observation


class Observation(Base):
    """eBird Basic Dataset sample: one Alabama county, March 2025."""

    __tablename__ = "observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    global_unique_identifier: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    last_edited_date: Mapped[str | None] = mapped_column(String, nullable=True)
    taxonomic_order: Mapped[float | None] = mapped_column(Float, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    common_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    scientific_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    observation_count: Mapped[str | None] = mapped_column(String, nullable=True)
    exotic_code: Mapped[str | None] = mapped_column(String, nullable=True)
    breeding_code: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    country_code: Mapped[str | None] = mapped_column(String, nullable=True)
    state: Mapped[str | None] = mapped_column(String, nullable=True)
    state_code: Mapped[str | None] = mapped_column(String, nullable=True)
    county: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    locality: Mapped[str | None] = mapped_column(String, nullable=True)
    locality_id: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    observation_date: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    time_observations_started: Mapped[str | None] = mapped_column(String, nullable=True)
    observer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sampling_event_identifier: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    protocol_name: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    effort_distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    number_observers: Mapped[float | None] = mapped_column(Float, nullable=True)
    all_species_reported: Mapped[str | None] = mapped_column(String, nullable=True)
    has_media: Mapped[str | None] = mapped_column(String, nullable=True)
    approved: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewed: Mapped[str | None] = mapped_column(String, nullable=True)


class SamplingEvent(Base):
    """eBird Basic Dataset sampling events (the effort companion file)."""

    __tablename__ = "sampling_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sampling_event_identifier: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    country_code: Mapped[str | None] = mapped_column(String, nullable=True)
    state_code: Mapped[str | None] = mapped_column(String, nullable=True)
    county: Mapped[str | None] = mapped_column(String, nullable=True)
    locality: Mapped[str | None] = mapped_column(String, nullable=True)
    locality_id: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    observation_date: Mapped[str | None] = mapped_column(String, nullable=True)
    time_observations_started: Mapped[str | None] = mapped_column(String, nullable=True)
    observer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    protocol_name: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    effort_distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    number_observers: Mapped[float | None] = mapped_column(Float, nullable=True)
    all_species_reported: Mapped[str | None] = mapped_column(String, nullable=True)
    checklist_comments: Mapped[str | None] = mapped_column(String, nullable=True)


# ---------------------------------------------------------------- migration


class GbifOccurrence(Base):
    """GBIF occurrence records: where and when each species was recorded.

    Balanced across the year (equal rows per month) so monthly maps are not
    skewed by sampling effort.
    """

    __tablename__ = "gbif_occurrences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    common_name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    scientific_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    month: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    country: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    country_code: Mapped[str | None] = mapped_column(String, nullable=True)
    basis_of_record: Mapped[str | None] = mapped_column(String, nullable=True)


class GbifMigrationSummary(Base):
    """Per-species monthly totals over the full GBIF record set.

    This is the migration curve: arrival, peak and departure months.
    """

    __tablename__ = "gbif_migration_summary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    common_name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    scientific_name: Mapped[str | None] = mapped_column(String, nullable=True)
    gbif_key: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    georeferenced_records: Mapped[int | None] = mapped_column(Integer, nullable=True)
    peak_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    top_countries: Mapped[str | None] = mapped_column(Text, nullable=True)
    month_01: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_02: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_03: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_04: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_05: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_06: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_07: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_08: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_09: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_10: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_11: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_12: Mapped[int | None] = mapped_column(Integer, nullable=True)


class EbirdMigrationSample(Base):
    """Seasonal presence pulled live from the eBird API.

    One row per region / year / month / species. NOTE: the eBird historic
    endpoint returns at most one record per species per day, so
    observation_count is always 1 — this table is presence/absence, not
    abundance. It answers "was it seen here this month", not "how many".
    For abundance curves use GbifMigrationSummary, which does carry counts.
    """

    __tablename__ = "ebird_migration_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    region_code: Mapped[str] = mapped_column(String, index=True, nullable=False)
    region_name: Mapped[str | None] = mapped_column(String, nullable=True)
    year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    month: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    species_code: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    common_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    scientific_name: Mapped[str | None] = mapped_column(String, nullable=True)
    observation_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_target: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    region_total_records: Mapped[int | None] = mapped_column(Integer, nullable=True)


class EbirdHotspot(Base):
    """Birding hotspots per region, from the eBird API."""

    __tablename__ = "ebird_hotspots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    region_code: Mapped[str] = mapped_column(String, index=True, nullable=False)
    loc_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    latest_obs_dt: Mapped[str | None] = mapped_column(String, nullable=True)
    num_species_all_time: Mapped[int | None] = mapped_column(Integer, nullable=True)


# ---------------------------------------------------------------- movement


class MovementIndividual(Base):
    """One row per tagged bird, from either tracking source.

    `source` says where the row came from:
      sagebrush - the local Movebank 33-1299 geolocator CSVs
      movebank  - pulled live from the Movebank direct-read API
    `study_id` is the Movebank study the bird belongs to (NULL for sagebrush).
    """

    __tablename__ = "movement_individuals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    study_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    tag_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    animal_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    animal_taxon: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    deploy_on_date: Mapped[str | None] = mapped_column(String, nullable=True)
    deploy_off_date: Mapped[str | None] = mapped_column(String, nullable=True)
    animal_life_stage: Mapped[str | None] = mapped_column(String, nullable=True)
    animal_marker_id: Mapped[str | None] = mapped_column(String, nullable=True)
    animal_reproductive_condition: Mapped[str | None] = mapped_column(String, nullable=True)
    animal_ring_id: Mapped[str | None] = mapped_column(String, nullable=True)
    animal_sex: Mapped[str | None] = mapped_column(String, nullable=True)
    attachment_type: Mapped[str | None] = mapped_column(String, nullable=True)
    capture_method: Mapped[str | None] = mapped_column(String, nullable=True)
    data_processing_software: Mapped[str | None] = mapped_column(String, nullable=True)
    deploy_off_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    deploy_off_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    deploy_on_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    deploy_on_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    deployment_end_type: Mapped[str | None] = mapped_column(String, nullable=True)
    deployment_id: Mapped[str | None] = mapped_column(String, nullable=True)
    duty_cycle: Mapped[str | None] = mapped_column(String, nullable=True)
    geolocator_calibration: Mapped[str | None] = mapped_column(String, nullable=True)
    study_site: Mapped[str | None] = mapped_column(String, nullable=True)
    tag_manufacturer_name: Mapped[str | None] = mapped_column(String, nullable=True)
    tag_mass: Mapped[float | None] = mapped_column(Float, nullable=True)
    tag_model: Mapped[str | None] = mapped_column(String, nullable=True)
    tag_readout_method: Mapped[str | None] = mapped_column(String, nullable=True)

    tracks: Mapped[list["MovementTrack"]] = relationship(
        back_populates="individual", cascade="all, delete-orphan"
    )


class MovementTrack(Base):
    """One position fix. Sagebrush rows carry geolocator bounds; Movebank rows
    do not, so the lower/upper columns stay NULL for those."""

    __tablename__ = "movement_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    study_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    event_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    individual_local_identifier: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    tag_local_identifier: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    canonical_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    timestamp: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    lat_lower: Mapped[float | None] = mapped_column(Float, nullable=True)
    lat_upper: Mapped[float | None] = mapped_column(Float, nullable=True)
    long_lower: Mapped[float | None] = mapped_column(Float, nullable=True)
    long_upper: Mapped[float | None] = mapped_column(Float, nullable=True)
    sensor_type: Mapped[str | None] = mapped_column(String, nullable=True)
    study_name: Mapped[str | None] = mapped_column(String, nullable=True)

    individual_local_identifier_fk: Mapped[str | None] = mapped_column(String, nullable=True)
    individual_id: Mapped[int | None] = mapped_column(
        ForeignKey("movement_individuals.id"), index=True, nullable=True
    )

    individual: Mapped["MovementIndividual | None"] = relationship(back_populates="tracks")


class MovebankStudy(Base):
    """Metadata for a Movebank study whose tracks were pulled.

    Kept so every track traces back to its study, licence and citation.
    Movebank requires citation for CC BY / CC BY-NC data, so the citation
    string is stored verbatim.
    """

    __tablename__ = "movebank_studies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    study_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    species: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    license_type: Mapped[str | None] = mapped_column(String, nullable=True)
    license_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    citation: Mapped[str | None] = mapped_column(Text, nullable=True)
    acknowledgements: Mapped[str | None] = mapped_column(Text, nullable=True)
    principal_investigator: Mapped[str | None] = mapped_column(String, nullable=True)
    number_of_individuals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    number_of_deployments: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sensor_type_ids: Mapped[str | None] = mapped_column(String, nullable=True)
    url: Mapped[str | None] = mapped_column(String, nullable=True)


# ---------------------------------------------------------------- Wikipedia / prose


class SpeciesSummary(Base):
    """A short plain-text description of a species.

    Pulled from the Wikipedia REST summary endpoint by scientific name — the
    2-5 sentence lead, not the whole article. The scientific name is the join
    key rather than a Species foreign key, because most species here (all
    11,009 AVONET names) do not have a Species row of their own.

    `wikipedia_url` is stored so the UI can offer a "read on Wikipedia" link.
    """

    __tablename__ = "species_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scientific_name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    wikipedia_url: Mapped[str | None] = mapped_column(String, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="wikipedia")


class PhylogenyFamily(Base):
    """Nodes of the BirdLife family tree.

    The tree has 243 named family tips plus unnamed internal clades, which are
    stored as ``clade_<n>`` so the whole topology is navigable. is_family is 1
    only for the 243 named families.
    """

    __tablename__ = "phylogeny_families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    parent_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    is_family: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class PhylogenySpecies(Base):
    """Species-level nodes of the Hackett Stage-1 tree (6,670 tips)."""

    __tablename__ = "phylogeny_species"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scientific_name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)


class RichnessCell(Base):
    """AVONET equal-area grid cells with per-cell species richness.

    `world_id` alone identifies a cell but says nothing about where it is, so
    the loader joins in the cell's centre and country from the Behrmann grid
    shapefile and the cell-to-country table that ship beside the richness CSV.
    Without those columns this table can only be counted, not mapped.
    """

    __tablename__ = "richness_cells"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    world_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    total_richness: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sampled_richness: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unsampled_richness: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, index=True, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    country: Mapped[str | None] = mapped_column(String, index=True, nullable=True)


# ---------------------------------------------------------------- images


class SpeciesImage(Base):
    """One representative picture per species.

    Two sources, stored two different ways on purpose:

      dataset   - a picture from the bird-525 image dataset itself (local parquet).
                  Stored as bytes in `image`, so the species the classifier knows
                  are always available offline with no network call.
      wikipedia - a lead image pulled from the Wikipedia API by scientific name.
                  Stored as URLs only (thumbnail, original, Wikipedia page). No
                  bytes: downloading and storing ~11,000 more JPEGs would bloat
                  the database and the compute for no benefit, since these are
                  browsed rather than fed to a model.

    So `image` is populated for dataset rows and NULL for wikipedia rows, and the
    url columns are the other way round.
    """

    __tablename__ = "species_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scientific_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    common_name: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    label_index: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    source: Mapped[str] = mapped_column(String, index=True, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    original_url: Mapped[str | None] = mapped_column(String, nullable=True)
    wikipedia_url: Mapped[str | None] = mapped_column(String, nullable=True)
    attribution: Mapped[str | None] = mapped_column(String, nullable=True)
    license: Mapped[str | None] = mapped_column(String, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bytes_len: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)



class SpeciesAudio(Base):
    """One Xeno-canto recording, as metadata only — never the audio itself.

    The bytes stay on Xeno-canto's servers and the API streams them through
    on demand, which is both what their terms favour and the only sane choice
    for a file that can be tens of megabytes. What is stored here is the
    catalogue entry: who recorded it, where, when, under which licence, and the
    URL to fetch it from.

    Rows are written lazily — the first time a species page asks for sound, its
    recordings are pulled from the archive and kept, so repeat views cost
    nothing and the archive is queried once per species rather than per view.
    """

    __tablename__ = "species_audio"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Xeno-canto's own catalogue number, e.g. 694038 for XC694038.
    xc_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    scientific_name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    common_name: Mapped[str | None] = mapped_column(String, nullable=True)
    recordist: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    locality: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # song / call / alarm call / flight call — what the bird was doing.
    sound_type: Mapped[str | None] = mapped_column(String, nullable=True)
    sex: Mapped[str | None] = mapped_column(String, nullable=True)
    stage: Mapped[str | None] = mapped_column(String, nullable=True)
    # A-E in the archive's own scale; A is the cleanest.
    quality: Mapped[str | None] = mapped_column(String, nullable=True)
    # mp3 / wav / flac, taken from the name the recordist uploaded. The archive
    # serves the original file and does not transcode, so this is the only
    # warning a client gets that a recording may be tens of megabytes.
    format: Mapped[str | None] = mapped_column(String, nullable=True)
    length: Mapped[str | None] = mapped_column(String, nullable=True)
    recorded_date: Mapped[str | None] = mapped_column(String, nullable=True)
    license: Mapped[str | None] = mapped_column(String, nullable=True)
    remarks: Mapped[str | None] = mapped_column(String, nullable=True)
    # The archive's download URL and its page. The page is what embedded
    # players use, and is the fallback when the download URL refuses us.
    file_url: Mapped[str | None] = mapped_column(String, nullable=True)
    page_url: Mapped[str | None] = mapped_column(String, nullable=True)
    sonogram_url: Mapped[str | None] = mapped_column(String, nullable=True)
    fetched_at: Mapped[str | None] = mapped_column(String, nullable=True)


class CubClass(Base):
    __tablename__ = "cub_classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    class_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    class_name: Mapped[str] = mapped_column(String, nullable=False)
    scientific_name: Mapped[str | None] = mapped_column(String, nullable=True)


class CubImage(Base):
    __tablename__ = "cub_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    image_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    image_name: Mapped[str | None] = mapped_column(String, nullable=True)
    class_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    is_training: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bbox_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_w: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_h: Mapped[float | None] = mapped_column(Float, nullable=True)


Index("ix_traits_family_mass", Trait.family, Trait.mass_g)
Index("ix_gbif_name_month", GbifOccurrence.common_name, GbifOccurrence.month)
Index("ix_tracks_name_ts", MovementTrack.canonical_name, MovementTrack.timestamp)
# Grouping 742,755 tracks by study is a full scan without this; the API does it
# to report per-study counts, and to find which studies back a species.
Index("ix_tracks_study", MovementTrack.study_id)
Index("ix_tracks_source", MovementTrack.source)
Index("ix_individuals_taxon", MovementIndividual.animal_taxon)
