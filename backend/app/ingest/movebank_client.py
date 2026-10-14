"""Real GPS tracks from Movebank, via the authenticated direct-read service.

A hand-picked set of well-tracked migrant species across several flyways (see
CURATED). Events are requested with the EURING_01 reduction, which returns one
point per individual per day — enough to draw a migration path without pulling
tens of millions of raw fixes.

Two things Movebank requires that are easy to get wrong:

* **Licence acceptance.** Until a study's terms are accepted, direct-read
  returns an HTML licence page instead of data. The documented way to accept is
  to MD5 that page's bytes and re-send the request with `license-md5=<hash>`.
  The hash is per study and per user, and does not depend on the other
  parameters, so it is computed once with a bare request.
* **Which studies are downloadable.** Being able to *see* a study
  (`i_can_see_data`) is not the same as being able to *download* it
  (`i_have_download_access`); only the latter studies return data. The curated
  ids below were all confirmed against the latter column.
"""

import csv
import hashlib
import io
import time

import requests
from sqlalchemy import delete, insert, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import MovebankStudy, MovementIndividual, MovementTrack

# One point per individual per day.
REDUCTION = "EURING_01"
ATTR = (
    "timestamp,location_lat,location_long,"
    "individual_local_identifier,individual_taxon_canonical_name"
)
RETRIES = 6
DELAY = 2.0  # seconds between studies; be a good citizen

# Curated famous migrants. All confirmed downloadable (i_have_download_access)
# with GPS or Argos positions. Grouped roughly by flyway.
CURATED: list[tuple[str, str]] = [
    ("7431347", "White Stork"),
    ("21231406", "White Stork"),
    ("76367850", "White Stork"),
    ("1252230318", "White Stork"),
    ("332044860", "White Stork"),
    ("1543123177", "Sooty Tern"),
    ("961039869", "Manx Shearwater"),
    ("1442516400", "Snow Goose"),
    ("2105214573", "Canada Goose"),
    ("2290252202", "Greylag Goose"),
    ("1448377103", "Wood Stork"),
    ("1744814602", "Whooping Crane"),
    ("1402467516", "Black Kite"),
    ("294524920", "Black Kite"),
    ("3094468724", "Egyptian Vulture"),
    ("481458", "Griffon Vulture"),
    ("384172482", "Osprey"),
    ("8868155", "Osprey"),
    ("3168000943", "Northern Gannet"),
    ("305974507", "Northern Gannet"),
    ("1718959411", "Bar-tailed Godwit"),
    ("42451582", "Long-billed Curlew"),
    ("1128676353", "Buff-breasted Sandpiper"),
    ("2454115135", "Semipalmated Sandpiper"),
    ("8004256372", "Eurasian Woodcock"),
    ("12170798", "Eurasian Woodcock"),
    ("180290122", "Antarctic Petrel"),
    ("121041109", "Antarctic Petrel"),
    ("2989306200", "Swallow-tailed Gull"),
    ("1428937421", "Red-tailed Tropicbird"),
    ("918236709", "Yellow-nosed Albatross"),
    ("2970193504", "Common Kestrel"),
    ("11017705", "Mallard"),
    ("447975336", "Swainson's Thrush"),
]


def _auth() -> tuple[str, str]:
    return (settings.movebank_user, settings.movebank_password)


def _get(params: dict) -> bytes | None:
    """One request to direct-read, with retries. Returns the raw body bytes.

    Bytes, not text: the licence hash must be taken over exactly what the
    server sent. Movebank sends no charset, so requests would decode as
    ISO-8859-1 and re-encoding would change the hash.
    """
    last = None
    for attempt in range(RETRIES):
        try:
            r = requests.get(
                settings.movebank_base_url,
                params=params,
                headers={"User-Agent": "bird-atlas/0.1 (educational bird data project)"},
                auth=_auth(),
                timeout=180,
            )
            if r.status_code == 200:
                return r.content
            if r.status_code == 429:
                # Rate-limited. Back off hard and honour Retry-After if given.
                retry_after = r.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else 30.0
                print("      rate limited, waiting %.0fs" % wait, flush=True)
                time.sleep(wait)
                continue
            last = "HTTP %s" % r.status_code
        except Exception as exc:
            last = type(exc).__name__
        time.sleep(2.0 * (attempt + 1))
    print("      request failed: %s" % last, flush=True)
    return None


def _is_html(body: bytes | None) -> bool:
    return bool(body) and body.lstrip()[:1] == b"<"


def _events_csv(study_id: str) -> str | None:
    """Daily-reduced events for a study, accepting the licence if needed.

    The reduction and attribute list are sent on the first call too, not just
    after a licence is accepted. Some studies need no licence and return data
    straight away — without the reduction there that call would hand back every
    raw fix in the study (hundreds of thousands of rows, and large enough that
    Movebank truncates the response mid-stream).
    """
    params = {
        "entity_type": "event",
        "study_id": study_id,
        "event_reduction_profile": REDUCTION,
        "attributes": ATTR,
    }

    first = _get(params)
    if first is None:
        return None
    if not _is_html(first):
        return first.decode("utf-8", "replace")  # no licence needed

    if b"No data are available" in first:
        return None

    # The licence page: hash its exact bytes, then re-ask with the hash.
    params["license-md5"] = hashlib.md5(first).hexdigest()
    second = _get(params)
    if second is None or _is_html(second):
        return None
    return second.decode("utf-8", "replace")


def _parse_events(text: str) -> list[dict]:
    rows = []
    for row in csv.DictReader(io.StringIO(text)):
        lat, lon = row.get("location_lat"), row.get("location_long")
        if not lat or not lon:
            continue
        try:
            lat_f, lon_f = float(lat), float(lon)
        except ValueError:
            continue
        rows.append({
            "timestamp": row.get("timestamp"),
            "latitude": lat_f,
            "longitude": lon_f,
            "individual_local_identifier": row.get("individual_local_identifier"),
            "canonical_name": row.get("individual_taxon_canonical_name"),
        })
    return rows


def _study_metadata(db: Session, study_list_csv: str) -> dict[str, dict]:
    """Index the study list by id for the curated studies."""
    wanted = {sid for sid, _ in CURATED}
    out: dict[str, dict] = {}
    for row in csv.DictReader(io.StringIO(study_list_csv)):
        if row.get("id") in wanted:
            out[row["id"]] = row
    return out


def load_movebank(db: Session, verbose: bool = True) -> tuple[int, int, int]:
    """Pull the curated studies into movebank_studies / movement_individuals /
    movement_tracks. Idempotent: everything previously loaded from Movebank is
    replaced, and the Sagebrush rows are tagged with their source."""
    if not settings.movebank_enabled:
        print("      no Movebank credentials in .env, skipping", flush=True)
        return (0, 0, 0)

    # --- idempotency -------------------------------------------------------
    # Sagebrush rows predate the `source` column; tag them once.
    db.execute(update(MovementTrack).where(MovementTrack.source.is_(None)).values(source="sagebrush"))
    db.execute(update(MovementIndividual).where(MovementIndividual.source.is_(None)).values(source="sagebrush"))
    db.execute(delete(MovementTrack).where(MovementTrack.source == "movebank"))
    db.execute(delete(MovementIndividual).where(MovementIndividual.source == "movebank"))
    db.execute(delete(MovebankStudy))
    db.commit()

    # --- study metadata ----------------------------------------------------
    study_body = _get({"entity_type": "study"})
    study_csv = study_body.decode("utf-8", "replace") if study_body else ""
    meta = _study_metadata(db, study_csv) if study_csv else {}

    n_studies = n_individuals = n_tracks = 0
    for study_id, label in CURATED:
        text = _events_csv(study_id)
        if not text:
            if verbose:
                print("      study %-10s %-22s no data" % (study_id, label), flush=True)
            time.sleep(DELAY)
            continue

        events = _parse_events(text)
        if not events:
            if verbose:
                print("      study %-10s %-22s no positions" % (study_id, label), flush=True)
            time.sleep(DELAY)
            continue

        # One individual row per distinct individual in the pull.
        seen: dict[str, int] = {}
        for e in events:
            ident = e["individual_local_identifier"]
            if ident not in seen:
                row = MovementIndividual(
                    source="movebank", study_id=study_id, animal_id=ident,
                    animal_taxon=e["canonical_name"] or label,
                )
                db.add(row)
                db.flush()
                seen[ident] = row.id

        db.execute(insert(MovementTrack), [{
            "source": "movebank",
            "study_id": study_id,
            "individual_local_identifier": e["individual_local_identifier"],
            "canonical_name": e["canonical_name"] or label,
            "timestamp": e["timestamp"],
            "latitude": e["latitude"],
            "longitude": e["longitude"],
            "study_name": label,
            "individual_id": seen.get(e["individual_local_identifier"]),
        } for e in events])

        m = meta.get(study_id, {})
        db.add(MovebankStudy(
            study_id=study_id,
            name=m.get("name") or label,
            species=events[0]["canonical_name"] or label,
            license_type=m.get("license_type"),
            license_terms=m.get("license_terms"),
            citation=m.get("citation"),
            acknowledgements=m.get("acknowledgements"),
            principal_investigator=m.get("principal_investigator_name"),
            number_of_individuals=int(m["number_of_individuals"]) if m.get("number_of_individuals") else None,
            number_of_deployments=int(m["number_of_deployments"]) if m.get("number_of_deployments") else None,
            sensor_type_ids=m.get("sensor_type_ids"),
            url="https://www.movebank.org/panel_embedded_movebank_webapp?gwt_fragment=page=studies,path=study" + study_id,
        ))
        db.commit()

        n_studies += 1
        n_individuals += len(seen)
        n_tracks += len(events)
        if verbose:
            print("      %-10s %-22s %4d individuals %6d points"
                  % (study_id, label, len(seen), len(events)), flush=True)
        time.sleep(DELAY)

    return (n_studies, n_individuals, n_tracks)
