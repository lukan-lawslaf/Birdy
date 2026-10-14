from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    # SQLite lives next to the backend, same layout as the Rayquaza project.
    database_url: str = "sqlite:///./birds.db"
    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,"
        "https://*.onrender.com"
    )

    # eBird API. The key may be spelled several ways in .env; the existing file
    # uses eBird=<key>.
    ebird_key: str = Field(
        default="",
        validation_alias=AliasChoices("EBIRD_KEY", "eBird", "ebird", "EBIRD"),
    )
    ebird_base_url: str = "https://api.ebird.org/v2"
    # eBird historic lookups are slow (~4s); this is the pause between calls.
    ebird_request_delay_seconds: float = 1.0

    # Movebank account, used by the direct-read service for tracking data.
    movebank_user: str = Field(
        default="",
        validation_alias=AliasChoices("MOVEBANK_USER", "MOVE_BANK_USER", "movebank_user"),
    )
    movebank_password: str = Field(
        default="",
        validation_alias=AliasChoices("MOVEBANK_PASSWORD", "MOVE_BANK_PASSWORD", "movebank_password"),
    )
    movebank_base_url: str = "https://www.movebank.org/movebank/service/direct-read"

    # Xeno-canto sound archive. API v3 needs a personal key from
    # https://xeno-canto.org/account — the site login alone does not grant it,
    # and v2 is retired (it now answers 404).
    xeno_canto_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "XENO_CANTO_KEY", "XENOCANTO_KEY", "XC_KEY", "xeno_canto_key"
        ),
    )
    xeno_canto_base_url: str = "https://xeno-canto.org/api/3"
    # Xeno-canto throttles; keep the pause between successive archive queries.
    xeno_canto_request_delay_seconds: float = 1.0

    # Bulk data lives outside OneDrive because it is several GB. These point at
    # the raw sources under the project's data/ folder.
    data_dir: str = "../data"
    # The downloaded 525-species image dataset and the migration CSVs, kept
    # outside OneDrive to avoid syncing 2 GB.
    bulk_data_dir: str = "C:/Users/Nakul/bird-data"
    migration_csv_dir: str = "C:/Users/Nakul/bird-data/migration"

    # The image classifier, checked into the project under models/.
    classifier_model: str = "../models/bird-525-swin-int8.onnx"
    classifier_labels: str = "../models/bird-525-labels.json"

    model_config = SettingsConfigDict(env_file=PROJECT_DIR / ".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ebird_enabled(self) -> bool:
        return bool(self.ebird_key.strip())

    @property
    def movebank_enabled(self) -> bool:
        return bool(self.movebank_user.strip() and self.movebank_password.strip())

    @property
    def xeno_canto_enabled(self) -> bool:
        return bool(self.xeno_canto_key.strip())

    def resolve_path(self, relative: str) -> Path:
        p = Path(relative)
        if p.is_absolute():
            return p
        return (BACKEND_DIR / relative).resolve()


settings = Settings()
