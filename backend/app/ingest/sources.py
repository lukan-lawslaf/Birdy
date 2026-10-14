"""Readers for the raw source files.

The sources are a mix of plain CSV, zipped CSV, a zip inside a zip, and a
tarball, so each gets a small helper. Nothing is extracted to disk; everything
is streamed out of the archive.
"""

import io
import re
import struct
import tarfile
import unicodedata
import zipfile
from pathlib import Path

from app.config import settings

DATA = settings.resolve_path(settings.data_dir)
BULK = Path(settings.bulk_data_dir)

AVONET_ZIP = DATA / "16586228.zip"
AVONET_INNER = "ELEData.zip"
AVONET_TRAITS = "ELEData/TraitData/AVONET1_BirdLife.csv"
AVONET_FAMILY_TREE = "ELEData/PhylogeneticData/Birdlife_Family_Phylogeny.nex"
AVONET_SPECIES_TREE = "ELEData/PhylogeneticData/HackettStage1_0001_1000_MCCTreeTargetHeights.nex"
AVONET_RICHNESS = "ELEData/SpatialData/RichnessTable.csv"

# The richness table itself carries only a cell id and counts. These three
# files beside it are what turn a cell id into a place: the polygon grid, its
# attribute table, and a cell-to-country lookup. They ship in the same archive,
# so no shapefile library is needed — both formats are simple enough to read
# directly, and this avoids a GDAL/pyproj dependency for two small files.
GRID_SHP = "ELEData/SpatialData/BehrmannMeterGrid_WGS84_land.shp"
GRID_DBF = "ELEData/SpatialData/BehrmannMeterGrid_WGS84_land.dbf"
GRID_COUNTRY = "ELEData/SpatialData/CountryBehrmannMeterGrid_WGS84_land.csv"

BIRDLIFE_ZIP = DATA / "species-filter-results.zip"
BIRDLIFE_CSV = "species-filter-results.csv"

EBIRD_TAXONOMY_ZIP = DATA / "eBird_Taxonomy_v2021.csv.zip"
EBIRD_TAXONOMY_CSV = "eBird_Taxonomy_v2021.csv"

EBD_ZIP = DATA / "ebd-datafile-SAMPLE.zip"
EBD_OBS = "ebd_US-AL-125_202503_202503_smp_relMar-2025.txt"
EBD_SAMPLING = "ebd_US-AL-125_202503_202503_smp_relMar-2025_sampling.txt"

TRACKS_CSV = DATA / "Sagebrush songbirds - University of Wyoming - 33-1299-tracks.csv"
INDIVIDUALS_CSV = (
    DATA / "Sagebrush songbirds - University of Wyoming - 33-1299_part-reference-data.csv"
)

CUB_TGZ = DATA / "CUB_200_2011.tgz"
CUB_CLASSES = "CUB_200_2011/classes.txt"
CUB_IMAGES = "CUB_200_2011/images.txt"
CUB_LABELS = "CUB_200_2011/image_class_labels.txt"
CUB_SPLIT = "CUB_200_2011/train_test_split.txt"
CUB_BBOXES = "CUB_200_2011/bounding_boxes.txt"

IMAGE_DATASET_LABELS = BULK / "birds-525" / "README.md"
MIGRATION_DIR = Path(settings.migration_csv_dir)
MIGRATION_SUMMARY = MIGRATION_DIR / "migration-summary.csv"

# Hand-written corrections for the image dataset's misspelled, renamed and
# generic class names. Lives next to the backend so it can be reviewed.
NAME_ALIASES = Path(__file__).resolve().parents[2] / "name_aliases.csv"


def _text(fileobj, encoding="utf-8-sig"):
    return io.TextIOWrapper(fileobj, encoding=encoding, newline="")


def open_zip_csv(zip_path: Path, member: str, encoding="utf-8-sig"):
    zf = zipfile.ZipFile(zip_path)
    return _text(zf.open(member), encoding)


def open_nested_zip_csv(outer: Path, inner_name: str, member: str, encoding="utf-8-sig"):
    """For 16586228.zip, which contains ELEData.zip, which contains the CSVs."""
    outer_zf = zipfile.ZipFile(outer)
    inner_zf = zipfile.ZipFile(io.BytesIO(outer_zf.read(inner_name)))
    return _text(inner_zf.open(member), encoding)


def read_nested_zip_text(outer: Path, inner_name: str, member: str) -> str:
    outer_zf = zipfile.ZipFile(outer)
    inner_zf = zipfile.ZipFile(io.BytesIO(outer_zf.read(inner_name)))
    return inner_zf.read(member).decode("utf8", errors="replace")


def read_nested_zip_bytes(outer: Path, inner_name: str, member: str) -> bytes:
    outer_zf = zipfile.ZipFile(outer)
    inner_zf = zipfile.ZipFile(io.BytesIO(outer_zf.read(inner_name)))
    return inner_zf.read(member)


# ------------------------------------------------------- shapefile and dBASE
# Both formats are simple binary layouts, and only two things are needed from
# them: which grid cell is where, and what it is called. Enough to read by hand
# rather than pull in GDAL.


def read_shapefile_polygon_centres(data: bytes) -> list[tuple[float, float]]:
    """Centre of each polygon's bounding box, in record order.

    Returns (latitude, longitude) — note that a shapefile stores X as longitude
    and Y as latitude, so this unpacks in the opposite order to the return.

    The AVONET grid cells are single polygons that are very nearly rectangles —
    one degree of longitude wide, and a band of latitude whose height varies
    with the Behrmann projection — so the bbox centre is the cell centre. The
    projection is plain WGS84 (see the matching .prj), so these come out as
    degrees directly, with no reprojection.

    Verified against the cell-to-country table: the United Kingdom's cells
    average 54.6N / -3.0E, Australia's 25.6S / 134.6E, Kenya's 0.7N / 37.9E.
    """
    if len(data) < 100 or struct.unpack("<i", data[32:36])[0] != 5:
        return []  # not a polygon shapefile

    centres = []
    position = 100  # 100-byte file header
    while position + 8 <= len(data):
        content = position + 8
        length = struct.unpack(">i", data[position + 4 : position + 8])[0]
        if length <= 0 or content + 4 > len(data):
            break
        if struct.unpack("<i", data[content : content + 4])[0] != 5:
            break
        x_min, y_min, x_max, y_max = struct.unpack("<4d", data[content + 4 : content + 36])
        centres.append(((y_min + y_max) / 2, (x_min + x_max) / 2))
        position = content + length * 2  # length is in 16-bit words
    return centres


def read_dbf_column(data: bytes, field: str) -> list[int | None]:
    """One numeric column from a dBASE table, in record order.

    Feeds the same order as the .shp, so the nth value here describes the nth
    polygon there.
    """
    if len(data) < 32:
        return []
    n_records = struct.unpack("<I", data[4:8])[0]
    header_size = struct.unpack("<H", data[8:10])[0]
    record_size = struct.unpack("<H", data[10:12])[0]

    # Walk the field descriptors to find where this column starts. Offset 1
    # skips the per-record deletion flag.
    offset = 1
    position = 32
    while position < header_size and position + 32 <= len(data) and data[position] != 0x0D:
        name = data[position : position + 11].split(b"\x00")[0].decode("ascii", "replace")
        length = data[position + 16]
        if name == field:
            values: list[int | None] = []
            for index in range(n_records):
                start = header_size + index * record_size + offset
                raw = data[start : start + length].decode("ascii", "replace").strip()
                try:
                    values.append(int(raw))
                except ValueError:
                    values.append(None)
            return values
        offset += length
        position += 32
    return []


def read_tar_text(tar_path: Path, member: str) -> str:
    with tarfile.open(tar_path, "r:gz") as tf:
        fh = tf.extractfile(member)
        return fh.read().decode("utf8", errors="replace") if fh else ""


def normalize_name(value: str | None) -> str:
    """Fold a name for matching: strip accents, drop everything but letters.

    Handles the two naming quirks in this data - the image dataset uses
    ALL-CAPS English names with typos, BirdLife/eBird use proper case and
    hyphens - so "Black-billed Cuckoo" and "BLACK BILLED CUCKOO" compare equal.
    """
    if not value:
        return ""
    folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", folded.lower())


def as_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value or value.upper() in {"NA", "N/A", "NULL"}:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def as_int(value: str | None) -> int | None:
    f = as_float(value)
    return int(f) if f is not None else None
