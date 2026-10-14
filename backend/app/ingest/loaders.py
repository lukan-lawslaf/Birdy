"""Loaders for each source dataset. One function per source, all idempotent."""

import csv
import json
import re

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.ingest import sources as src
from app.models import (
    Conservation,
    CubClass,
    CubImage,
    GbifMigrationSummary,
    GbifOccurrence,
    MovementIndividual,
    MovementTrack,
    Observation,
    PhylogenyFamily,
    PhylogenySpecies,
    RichnessCell,
    SamplingEvent,
    Species,
    Taxonomy,
    Trait,
)


def _rows(handle):
    return csv.DictReader(handle)


def _bulk_insert(db: Session, model, dicts: list[dict], chunk: int = 2000) -> int:
    if not dicts:
        return 0
    db.execute(delete(model))
    for i in range(0, len(dicts), chunk):
        db.bulk_insert_mappings(model, dicts[i : i + chunk])
    db.commit()
    return len(dicts)


# ------------------------------------------------------------------ traits


def load_traits(db: Session) -> int:
    """AVONET morphometrics, ecology and range for ~11,000 species."""
    out = []
    with src.open_nested_zip_csv(src.AVONET_ZIP, src.AVONET_INNER, src.AVONET_TRAITS) as fh:
        for r in _rows(fh):
            name = (r.get("Species1") or "").strip()
            if not name:
                continue
            out.append({
                "sequence": src.as_int(r.get("Sequence")),
                "scientific_name": name,
                "family": r.get("Family1") or None,
                "order_name": r.get("Order1") or None,
                "avibase_id": r.get("Avibase.ID1") or None,
                "total_individuals": src.as_int(r.get("Total.individuals")),
                "female": src.as_int(r.get("Female")),
                "male": src.as_int(r.get("Male")),
                "unknown_sex": src.as_int(r.get("Unknown")),
                "complete_measures": src.as_int(r.get("Complete.measures")),
                "beak_length_culmen_mm": src.as_float(r.get("Beak.Length_Culmen")),
                "beak_length_nares_mm": src.as_float(r.get("Beak.Length_Nares")),
                "beak_width_mm": src.as_float(r.get("Beak.Width")),
                "beak_depth_mm": src.as_float(r.get("Beak.Depth")),
                "tarsus_length_mm": src.as_float(r.get("Tarsus.Length")),
                "wing_length_mm": src.as_float(r.get("Wing.Length")),
                "kipps_distance_mm": src.as_float(r.get("Kipps.Distance")),
                "secondary1_mm": src.as_float(r.get("Secondary1")),
                "hand_wing_index": src.as_float(r.get("Hand-Wing.Index")),
                "tail_length_mm": src.as_float(r.get("Tail.Length")),
                "mass_g": src.as_float(r.get("Mass")),
                "mass_source": r.get("Mass.Source") or None,
                "inference": r.get("Inference") or None,
                "traits_inferred": r.get("Traits.inferred") or None,
                "reference_species": r.get("Reference.species") or None,
                "habitat": r.get("Habitat") or None,
                "habitat_density": r.get("Habitat.Density") or None,
                "migration": r.get("Migration") or None,
                "trophic_level": r.get("Trophic.Level") or None,
                "trophic_niche": r.get("Trophic.Niche") or None,
                "primary_lifestyle": r.get("Primary.Lifestyle") or None,
                "min_latitude": src.as_float(r.get("Min.Latitude")),
                "max_latitude": src.as_float(r.get("Max.Latitude")),
                "centroid_latitude": src.as_float(r.get("Centroid.Latitude")),
                "centroid_longitude": src.as_float(r.get("Centroid.Longitude")),
                "range_size_km2": src.as_float(r.get("Range.Size")),
            })
    return _bulk_insert(db, Trait, out)


# ------------------------------------------------------------------ conservation


def load_conservation(db: Session) -> int:
    """BirdLife IUCN status, population and range for ~11,185 species."""
    out = []
    with src.open_zip_csv(src.BIRDLIFE_ZIP, src.BIRDLIFE_CSV) as fh:
        for r in _rows(fh):
            name = (r.get("Scientific name") or "").strip()
            if not name:
                continue
            out.append({
                "sis_id": r.get("SIS ID") or None,
                "sequence": r.get("Sequence") or None,
                "family": r.get("Family") or None,
                "scientific_name": name,
                "common_name": r.get("Common name") or None,
                "rl_category": r.get("RL Category") or None,
                "pe": r.get("PE") or None,
                "pew": r.get("PEW") or None,
                "seabird": r.get("Seabird") or None,
                "waterbird": r.get("Waterbird") or None,
                "landbird": r.get("Landbird") or None,
                "migratory_status": r.get("Migratory status") or None,
                "ecosystem_terrestrial": r.get("Ecosystem - Terrestrial") or None,
                "ecosystem_freshwater": r.get("Ecosystem - Freshwater") or None,
                "ecosystem_marine": r.get("Ecosystem - Marine") or None,
                "rl_aoo": src.as_float(r.get("RL AOO")),
                "rl_eoo": src.as_float(
                    r.get("RL EOO (smaller of breeding and non-breeding EOO)")
                ),
                "population_size": r.get("Population size (mature individuals)") or None,
                "population_size_derivation": r.get("Population size derivation") or None,
                "population_trend": r.get("Current population trend") or None,
                "population_trend_derivation": r.get("Current population trend derivation") or None,
            })
    return _bulk_insert(db, Conservation, out)


# ------------------------------------------------------------------ taxonomy


def load_taxonomy(db: Session) -> int:
    out = []
    with src.open_zip_csv(src.EBIRD_TAXONOMY_ZIP, src.EBIRD_TAXONOMY_CSV) as fh:
        for r in _rows(fh):
            if not (r.get("SCI_NAME") or "").strip():
                continue
            out.append({
                "taxon_order": src.as_float(r.get("TAXON_ORDER")),
                "category": r.get("CATEGORY") or None,
                "species_code": r.get("SPECIES_CODE") or None,
                "primary_com_name": r.get("PRIMARY_COM_NAME") or None,
                "sci_name": r.get("SCI_NAME") or None,
                "order_name": r.get("ORDER1") or None,
                "family": r.get("FAMILY") or None,
                "species_group": r.get("SPECIES_GROUP") or None,
                "report_as": r.get("REPORT_AS") or None,
            })
    return _bulk_insert(db, Taxonomy, out)


# ------------------------------------------------------------------ eBird EBD sample


def load_observations(db: Session) -> tuple[int, int]:
    obs = []
    with src.open_zip_csv(src.EBD_ZIP, src.EBD_OBS, encoding="utf-8-sig") as fh:
        for r in _rows(fh):
            obs.append({
                "global_unique_identifier": r.get("GLOBAL UNIQUE IDENTIFIER") or None,
                "last_edited_date": r.get("LAST EDITED DATE") or None,
                "taxonomic_order": src.as_float(r.get("TAXONOMIC ORDER")),
                "category": r.get("CATEGORY") or None,
                "common_name": r.get("COMMON NAME") or None,
                "scientific_name": r.get("SCIENTIFIC NAME") or None,
                "observation_count": r.get("OBSERVATION COUNT") or None,
                "exotic_code": r.get("EXOTIC CODE") or None,
                "breeding_code": r.get("BREEDING CODE") or None,
                "country": r.get("COUNTRY") or None,
                "country_code": r.get("COUNTRY CODE") or None,
                "state": r.get("STATE") or None,
                "state_code": r.get("STATE CODE") or None,
                "county": r.get("COUNTY") or None,
                "locality": r.get("LOCALITY") or None,
                "locality_id": r.get("LOCALITY ID") or None,
                "latitude": src.as_float(r.get("LATITUDE")),
                "longitude": src.as_float(r.get("LONGITUDE")),
                "observation_date": r.get("OBSERVATION DATE") or None,
                "time_observations_started": r.get("TIME OBSERVATIONS STARTED") or None,
                "observer_id": r.get("OBSERVER ID") or None,
                "sampling_event_identifier": r.get("SAMPLING EVENT IDENTIFIER") or None,
                "protocol_name": r.get("PROTOCOL NAME") or None,
                "duration_minutes": src.as_float(r.get("DURATION MINUTES")),
                "effort_distance_km": src.as_float(r.get("EFFORT DISTANCE KM")),
                "number_observers": src.as_float(r.get("NUMBER OBSERVERS")),
                "all_species_reported": r.get("ALL SPECIES REPORTED") or None,
                "has_media": r.get("HAS MEDIA") or None,
                "approved": r.get("APPROVED") or None,
                "reviewed": r.get("REVIEWED") or None,
            })
    n_obs = _bulk_insert(db, Observation, obs)

    events = []
    with src.open_zip_csv(src.EBD_ZIP, src.EBD_SAMPLING) as fh:
        for r in _rows(fh):
            events.append({
                "sampling_event_identifier": r.get("SAMPLING EVENT IDENTIFIER") or None,
                "country_code": r.get("COUNTRY CODE") or None,
                "state_code": r.get("STATE CODE") or None,
                "county": r.get("COUNTY") or None,
                "locality": r.get("LOCALITY") or None,
                "locality_id": r.get("LOCALITY ID") or None,
                "latitude": src.as_float(r.get("LATITUDE")),
                "longitude": src.as_float(r.get("LONGITUDE")),
                "observation_date": r.get("OBSERVATION DATE") or None,
                "time_observations_started": r.get("TIME OBSERVATIONS STARTED") or None,
                "observer_id": r.get("OBSERVER ID") or None,
                "protocol_name": r.get("PROTOCOL NAME") or None,
                "duration_minutes": src.as_float(r.get("DURATION MINUTES")),
                "effort_distance_km": src.as_float(r.get("EFFORT DISTANCE KM")),
                "number_observers": src.as_float(r.get("NUMBER OBSERVERS")),
                "all_species_reported": r.get("ALL SPECIES REPORTED") or None,
                "checklist_comments": r.get("CHECKLIST COMMENTS") or None,
            })
    n_events = _bulk_insert(db, SamplingEvent, events)
    return n_obs, n_events


# ------------------------------------------------------------------ GBIF migration


def load_gbif_migration(db: Session) -> tuple[int, int]:
    occurrences = []
    if src.MIGRATION_DIR.exists():
        for path in sorted(src.MIGRATION_DIR.glob("*-occurrences.csv")):
            with open(path, encoding="utf-8-sig", newline="") as fh:
                for r in _rows(fh):
                    occurrences.append({
                        "common_name": r.get("common_name") or "",
                        "scientific_name": r.get("scientific_name") or None,
                        "month": src.as_int(r.get("month")),
                        "year": src.as_int(r.get("year")),
                        "latitude": src.as_float(r.get("decimalLatitude")),
                        "longitude": src.as_float(r.get("decimalLongitude")),
                        "country": r.get("country") or None,
                        "country_code": r.get("countryCode") or None,
                        "basis_of_record": r.get("basisOfRecord") or None,
                    })
    n_occ = _bulk_insert(db, GbifOccurrence, occurrences)

    summaries = []
    if src.MIGRATION_SUMMARY.exists():
        with open(src.MIGRATION_SUMMARY, encoding="utf-8-sig", newline="") as fh:
            for r in _rows(fh):
                row = {
                    "common_name": r.get("common_name") or "",
                    "scientific_name": r.get("scientific_name") or None,
                    "gbif_key": r.get("gbif_key") or None,
                    "note": r.get("note") or None,
                    "georeferenced_records": src.as_int(r.get("georeferenced_records")),
                    "peak_month": src.as_int(r.get("peak_month")),
                    "top_countries": r.get("top_countries") or None,
                }
                for m in range(1, 13):
                    row[f"month_{m:02d}"] = src.as_int(r.get(f"month_{m:02d}"))
                summaries.append(row)
    n_sum = _bulk_insert(db, GbifMigrationSummary, summaries)
    return n_occ, n_sum


# ------------------------------------------------------------------ movement


def load_movement(db: Session) -> tuple[int, int]:
    individuals = []
    with open(src.INDIVIDUALS_CSV, encoding="utf-8-sig", newline="") as fh:
        for r in _rows(fh):
            individuals.append({
                "source": "sagebrush",
                "study_id": None,
                "tag_id": r.get("tag-id") or None,
                "animal_id": r.get("animal-id") or None,
                "animal_taxon": r.get("animal-taxon") or None,
                "deploy_on_date": r.get("deploy-on-date") or None,
                "deploy_off_date": r.get("deploy-off-date") or None,
                "animal_life_stage": r.get("animal-life-stage") or None,
                "animal_marker_id": r.get("animal-marker-id") or None,
                "animal_reproductive_condition": r.get("animal-reproductive-condition") or None,
                "animal_ring_id": r.get("animal-ring-id") or None,
                "animal_sex": r.get("animal-sex") or None,
                "attachment_type": r.get("attachment-type") or None,
                "capture_method": r.get("capture-method") or None,
                "data_processing_software": r.get("data-processing-software") or None,
                "deploy_off_latitude": src.as_float(r.get("deploy-off-latitude")),
                "deploy_off_longitude": src.as_float(r.get("deploy-off-longitude")),
                "deploy_on_latitude": src.as_float(r.get("deploy-on-latitude")),
                "deploy_on_longitude": src.as_float(r.get("deploy-on-longitude")),
                "deployment_end_type": r.get("deployment-end-type") or None,
                "deployment_id": r.get("deployment-id") or None,
                "duty_cycle": r.get("duty-cycle") or None,
                "geolocator_calibration": r.get("geolocator-calibration") or None,
                "study_site": r.get("study-site") or None,
                "tag_manufacturer_name": r.get("tag-manufacturer-name") or None,
                "tag_mass": src.as_float(r.get("tag-mass")),
                "tag_model": r.get("tag-model") or None,
                "tag_readout_method": r.get("tag-readout-method") or None,
            })
    db.execute(delete(MovementTrack))
    db.execute(delete(MovementIndividual))
    db.commit()
    db.bulk_insert_mappings(MovementIndividual, individuals)
    db.commit()

    tag_to_id = {i.tag_id: i.id for i in db.query(MovementIndividual).all()}

    tracks = []
    with open(src.TRACKS_CSV, encoding="utf-8-sig", newline="") as fh:
        for r in _rows(fh):
            tag = r.get("tag-local-identifier")
            tracks.append({
                "source": "sagebrush",
                "study_id": None,
                "event_id": r.get("event-id") or None,
                "individual_local_identifier": r.get("individual-local-identifier") or None,
                "tag_local_identifier": tag or None,
                "canonical_name": r.get("individual-taxon-canonical-name") or None,
                "timestamp": r.get("timestamp") or None,
                "latitude": src.as_float(r.get("location-lat")),
                "longitude": src.as_float(r.get("location-long")),
                "lat_lower": src.as_float(r.get("lat-lower")),
                "lat_upper": src.as_float(r.get("lat-upper")),
                "long_lower": src.as_float(r.get("long-lower")),
                "long_upper": src.as_float(r.get("long-upper")),
                "sensor_type": r.get("sensor-type") or None,
                "study_name": r.get("study-name") or None,
                "individual_id": tag_to_id.get(tag),
            })
    for i in range(0, len(tracks), 2000):
        db.bulk_insert_mappings(MovementTrack, tracks[i : i + 2000])
    db.commit()
    return len(individuals), len(tracks)


# ------------------------------------------------------------------ phylogeny


def _newick_parents(newick: str, translate: dict | None = None) -> dict[str, str]:
    """Return {node_label: parent_label} for a Newick string.

    The BirdLife family tree labels its tips with indices and supplies a
    TRANSLATE block, so labels are resolved through it first. Unnamed internal
    nodes become clade_<n> to keep every node addressable.
    """
    translate = translate or {}
    parents: dict[str, str] = {}
    stack: list[str] = []
    label = ""
    counter = 0
    pending_rename: str | None = None
    skip_len = False

    def attach(name: str) -> None:
        if stack:
            parents[name] = stack[-1]

    def resolve_label() -> None:
        nonlocal label, pending_rename
        raw = label.strip().strip("'")
        label = ""
        if not raw:
            pending_rename = None
            return
        name = translate.get(raw, raw)
        if pending_rename is not None:
            old = pending_rename
            parent = parents.pop(old, None)
            if parent is not None:
                parents[name] = parent
            for child, par in list(parents.items()):
                if par == old:
                    parents[child] = name
            pending_rename = name
        else:
            attach(name)

    for ch in newick:
        if ch == "(":
            resolve_label()
            counter += 1
            node = f"clade_{counter}"
            attach(node)
            stack.append(node)
            pending_rename = None
        elif ch == ",":
            resolve_label()
            skip_len = False
        elif ch == ")":
            resolve_label()
            if stack:
                pending_rename = stack.pop()
            skip_len = False
        elif ch == ":":
            resolve_label()
            skip_len = True
        elif ch == ";":
            resolve_label()
        elif not skip_len:
            label += ch
    resolve_label()
    return parents


def _nexus_taxlabels(nexus: str) -> list[str]:
    block = re.search(r"TAXLABELS(.*?);", nexus, re.S)
    if not block:
        return []
    return [t.strip().strip("'") for t in block.group(1).split() if t.strip()]


def _nexus_translate(nexus: str) -> dict[str, str]:
    block = re.search(r"TRANSLATE(.*?);", nexus, re.S)
    if not block:
        return {}
    out: dict[str, str] = {}
    for line in block.group(1).splitlines():
        line = line.strip().rstrip(",")
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) == 2:
            out[parts[0]] = parts[1].strip().strip("'")
    return out


def _nexus_newick(nexus: str) -> str:
    m = re.search(r"tree\s+\S+\s*=\s*(.*?);", nexus, re.S | re.I)
    if m:
        return m.group(1)
    m = re.search(r"\(.*\)\s*\w*\s*;", nexus, re.S)
    return m.group(0) if m else ""


def load_phylogeny(db: Session) -> tuple[int, int]:
    """BirdLife family tree (243 families + internal clades) and the Hackett
    species-level tips (6,670 species)."""
    nexus = src.read_nested_zip_text(src.AVONET_ZIP, src.AVONET_INNER, src.AVONET_FAMILY_TREE)
    translate = _nexus_translate(nexus)
    parents = _newick_parents(_nexus_newick(nexus), translate)
    family_names = set(translate.values()) or set(_nexus_taxlabels(nexus))

    family_rows = [
        {
            "name": name,
            "parent_name": parents.get(name),
            "is_family": 1 if name in family_names else 0,
        }
        for name in parents
    ]
    n_fam = _bulk_insert(db, PhylogenyFamily, family_rows)

    species_nexus = src.read_nested_zip_text(
        src.AVONET_ZIP, src.AVONET_INNER, src.AVONET_SPECIES_TREE
    )
    tips = [t.replace("_", " ") for t in _nexus_taxlabels(species_nexus)]
    n_species = _bulk_insert(db, PhylogenySpecies, [{"scientific_name": t} for t in tips])
    return n_fam, n_species


# ------------------------------------------------------------------ richness


def load_richness(db: Session) -> int:
    """Per-cell species richness, with the cell's location joined in.

    The richness CSV has only a WorldID, so two companion files in the same
    archive supply the rest: the grid shapefile gives each cell's centre, and
    the cell-to-country table gives its country. The shapefile and its dBASE
    attribute table are parallel lists, so the nth geometry belongs to the nth
    WorldID.
    """
    centres = src.read_shapefile_polygon_centres(
        src.read_nested_zip_bytes(src.AVONET_ZIP, src.AVONET_INNER, src.GRID_SHP)
    )
    world_ids = src.read_dbf_column(
        src.read_nested_zip_bytes(src.AVONET_ZIP, src.AVONET_INNER, src.GRID_DBF), "WorldID"
    )
    placement: dict[int, tuple[float, float]] = {}
    if len(centres) == len(world_ids):
        placement = {
            wid: centres[i] for i, wid in enumerate(world_ids) if wid is not None
        }

    country: dict[int, str] = {}
    with src.open_nested_zip_csv(src.AVONET_ZIP, src.AVONET_INNER, src.GRID_COUNTRY) as fh:
        for r in _rows(fh):
            wid = src.as_int(r.get("WorldID"))
            if wid is not None:
                country[wid] = (r.get("Country") or "").strip() or None

    out = []
    with src.open_nested_zip_csv(src.AVONET_ZIP, src.AVONET_INNER, src.AVONET_RICHNESS) as fh:
        for r in _rows(fh):
            world_id = src.as_int(r.get("WorldID"))
            if world_id is None:
                continue
            lat, lon = placement.get(world_id, (None, None))
            out.append({
                "world_id": world_id,
                "total_richness": src.as_int(r.get("TotalRichness")),
                "sampled_richness": src.as_int(r.get("SampledRichness")),
                "unsampled_richness": src.as_int(r.get("UnSampledRichness")),
                "latitude": lat,
                "longitude": lon,
                "country": country.get(world_id),
            })
    return _bulk_insert(db, RichnessCell, out)


# ------------------------------------------------------------------ CUB-200-2011


def load_cub(db: Session) -> tuple[int, int]:
    classes = []
    for line in src.read_tar_text(src.CUB_TGZ, src.CUB_CLASSES).splitlines():
        line = line.strip()
        if not line:
            continue
        cid, name = line.split(None, 1)
        # "001.Black_footed_Albatross" -> "Black footed Albatross"
        pretty = name.split(".", 1)[-1].replace("_", " ")
        classes.append({"class_id": int(cid), "class_name": pretty, "scientific_name": None})
    db.execute(delete(CubClass))
    db.commit()
    db.bulk_insert_mappings(CubClass, classes)
    db.commit()

    names = {}
    for line in src.read_tar_text(src.CUB_TGZ, src.CUB_IMAGES).splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2:
            names[int(parts[0])] = parts[1]

    class_of = {}
    for line in src.read_tar_text(src.CUB_TGZ, src.CUB_LABELS).splitlines():
        parts = line.strip().split()
        if len(parts) == 2:
            class_of[int(parts[0])] = int(parts[1])

    split = {}
    for line in src.read_tar_text(src.CUB_TGZ, src.CUB_SPLIT).splitlines():
        parts = line.strip().split()
        if len(parts) == 2:
            split[int(parts[0])] = int(parts[1])

    boxes = {}
    for line in src.read_tar_text(src.CUB_TGZ, src.CUB_BBOXES).splitlines():
        parts = line.strip().split()
        if len(parts) == 5:
            boxes[int(parts[0])] = [float(x) for x in parts[1:]]

    images = []
    for image_id, image_name in names.items():
        box = boxes.get(image_id, [None, None, None, None])
        images.append({
            "image_id": image_id,
            "image_name": image_name,
            "class_id": class_of.get(image_id),
            "is_training": split.get(image_id),
            "bbox_x": box[0], "bbox_y": box[1], "bbox_w": box[2], "bbox_h": box[3],
        })
    n_images = _bulk_insert(db, CubImage, images)
    return len(classes), n_images


# ------------------------------------------------------------------ image species


def load_name_aliases() -> dict[str, str]:
    """Read name_aliases.csv into {normalized dataset name: resolved eBird name}.

    Rows with no resolved_name (the labels that are not a single species) are
    skipped, so those stay unmatched rather than getting a wrong answer.
    """
    aliases: dict[str, str] = {}
    if not src.NAME_ALIASES.exists():
        return aliases
    with open(src.NAME_ALIASES, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            resolved = (row.get("resolved_name") or "").strip()
            if resolved:
                aliases[src.normalize_name(row.get("dataset_name"))] = resolved
    return aliases


def load_species(db: Session) -> tuple[int, int, int]:
    """The 526 image classes, with scientific names resolved by name matching.

    Three passes, in order:
      1. BirdLife common name (already normalised, exact after folding)
      2. eBird taxonomy common name
      3. the hand-written alias table, then back through the eBird taxonomy
    Aliases come last so a real match always wins over a hand correction.
    """
    text = src.IMAGE_DATASET_LABELS.read_text(encoding="utf8", errors="replace")
    labels = re.findall(r"^          '(\d+)': (.+)$", text, re.M)
    if not labels:
        raise FileNotFoundError(
            f"could not read class labels from {src.IMAGE_DATASET_LABELS}"
        )

    # Build lookup tables from the two name backbones already loaded.
    birdlife = {}
    for row in db.query(Conservation).all():
        birdlife.setdefault(src.normalize_name(row.common_name), row)
    ebird = {}
    for row in db.query(Taxonomy).all():
        ebird.setdefault(src.normalize_name(row.primary_com_name), row)
    # Fallback for order: BirdLife has no order column, so take it from the
    # eBird taxonomy by scientific name.
    order_by_sci = {}
    for row in db.query(Taxonomy).all():
        if row.sci_name and row.order_name:
            order_by_sci.setdefault(row.sci_name.lower(), row.order_name)

    aliases = load_name_aliases()
    alias_used = 0

    rows = []
    matched = 0
    for index, name in labels:
        key = src.normalize_name(name)
        scientific = family = order = source = None
        hit = birdlife.get(key)
        if hit:
            scientific, family, source = hit.scientific_name, hit.family, "birdlife"
            order = order_by_sci.get((scientific or "").lower())
            matched += 1
        else:
            hit = ebird.get(key)
            if hit:
                scientific, family, order, source = (
                    hit.sci_name, hit.family, hit.order_name, "ebird",
                )
                matched += 1
            else:
                resolved = aliases.get(key)
                hit = ebird.get(src.normalize_name(resolved)) if resolved else None
                if hit:
                    scientific, family, order, source = (
                        hit.sci_name, hit.family, hit.order_name, "alias",
                    )
                    matched += 1
                    alias_used += 1
        rows.append({
            "label_index": int(index),
            "name": name.strip(),
            "scientific_name": scientific,
            "family": family,
            "order_name": order,
            "match_source": source,
        })
    n = _bulk_insert(db, Species, rows)
    return n, matched, alias_used
