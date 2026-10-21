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

    # --- the identification agent -------------------------------------------
    # Two hosted providers. Neither is required: without a key the agent still
    # identifies and still answers, it just writes the summary from a template
    # instead of having a model write it.
    #
    # Groq is supported but not in the default chain — this key answers 401 on
    # /chat/completions. Put "groq:<model>" in agent_text_models to use it once
    # the key works.
    groq_key: str = Field(
        default="",
        validation_alias=AliasChoices("GROQ_KEY", "Groq_Key", "groq_key", "GROQ_API_KEY"),
    )
    google_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "GOOGLE_KEY", "Google_key", "google_key", "GEMINI_KEY", "GOOGLE_API_KEY"
        ),
    )
    # Fallback chain for writing prose, tried left to right as "provider:model".
    #
    # Measured on this key, 2026-10-14, with the real summary prompt (939 chars):
    #   gemini-3.1-flash-lite   2.0 s, 106 output tokens, clean prose
    #   gemma-4-26b-a4b-it     64.8 s, spent all 2998 tokens thinking, returned ""
    #   openai/gpt-oss-120b    HTTP 401, the Groq key is not valid for completions
    #
    # Gemma is excluded rather than demoted. `maxOutputTokens` on this API counts
    # thinking *and* output against one budget, and Gemma rejects
    # thinkingConfig ("Thinking budget is not supported for this model"), so a
    # prompt this long leaves it no room to answer — at any budget. Keep both
    # links in the gemini family: thinkingBudget 0 works there, which is what
    # makes the difference between 2 seconds and a minute.
    agent_text_models: str = "google:gemini-3.1-flash-lite,google:gemini-3-flash-preview"
    # The only vision model that both works and is generous here. Used to give a
    # second opinion when the classifier is unsure, never on every upload.
    agent_vision_model: str = "google:gemini-3.1-flash-lite"
    agent_vision_fallbacks: str = "google:gemini-3-flash-preview"
    # Below this top-1 confidence the photo is sent for a second opinion. The
    # classifier is 98% top-1 on its own validation split, so a score this low
    # usually means the bird is not one of its 526 classes at all.
    agent_vision_threshold: float = 0.45
    agent_timeout_seconds: float = 15.0
    agent_max_output_tokens: int = 900

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

    @property
    def agent_text_chain(self) -> list[tuple[str, str]]:
        """`agent_text_models` parsed into (provider, model) pairs."""
        pairs = []
        for entry in self.agent_text_models.split(","):
            entry = entry.strip()
            if not entry:
                continue
            provider, _, model = entry.partition(":")
            if model:
                pairs.append((provider.strip().lower(), model.strip()))
        return pairs

    @property
    def agent_vision_pair(self) -> tuple[str, str]:
        provider, _, model = self.agent_vision_model.partition(":")
        return provider.strip().lower(), model.strip()

    @property
    def agent_enabled(self) -> bool:
        return bool(self.groq_key.strip() or self.google_key.strip())

    def resolve_path(self, relative: str) -> Path:
        p = Path(relative)
        if p.is_absolute():
            return p
        return (BACKEND_DIR / relative).resolve()


settings = Settings()
