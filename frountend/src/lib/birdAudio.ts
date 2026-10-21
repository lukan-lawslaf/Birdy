import { assetUrl, getSpeciesAudio, getCommonsAudio } from "./api";

interface Recording { url: string; credit: string; pageUrl: string; licenseUrl: string }
interface Playback {
  species: string;
  phase: "idle" | "loading" | "playing" | "error";
  message?: string;
  recording?: Recording;
}

/** One player for the site. Changing the request cancels all older loads. */
class BirdAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private version = 0;
  private cancelLoad?: () => void;
  private snapshot: Playback = { species: "", phase: "idle" };
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private update(state: Playback) { this.snapshot = state; this.listeners.forEach((listener) => listener()); }

  stop = () => {
    this.version += 1;
    this.cancelLoad?.();
    this.cancelLoad = undefined;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    this.update({ species: "", phase: "idle" });
  };

  private async start(recording: Recording, species: string, version: number) {
    if (version !== this.version) return false;
    const audio = new Audio(recording.url);
    audio.volume = .85;
    this.audio = audio;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Recording timed out")), 12000);
        const cancel = () => reject(new Error("Cancelled"));
        this.cancelLoad = cancel;
        audio.play().then(resolve, reject).finally(() => {
          clearTimeout(timer);
          if (this.cancelLoad === cancel) this.cancelLoad = undefined;
        });
      });
      if (version !== this.version) { audio.pause(); return false; }
      this.update({ species, phase: "playing", recording });
      audio.onended = () => { if (version === this.version) this.stop(); };
      audio.onerror = () => {
        if (version === this.version) {
          this.stop();
          this.update({ species, phase: "error", message: "The recording stopped loading. Please try again." });
        }
      };
      return true;
    } catch {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return false;
    }
  }

  async playRecording(scientificName: string): Promise<boolean> {
    this.stop();
    const version = this.version;
    this.update({ species: scientificName, phase: "loading" });
    try {
      const list = await getSpeciesAudio(scientificName, 3);
      for (const row of list.recordings.slice(0, 2)) {
        if (version !== this.version) return false;
        if (await this.start({
          url: assetUrl(row.stream_url),
          credit: `${row.recordist ?? "Recordist"} · Xeno-canto XC${row.xc_id}`,
          pageUrl: row.page_url ?? `https://xeno-canto.org/${row.xc_id}`,
          licenseUrl: row.license ?? row.page_url ?? "https://xeno-canto.org/",
        }, scientificName, version)) return true;
      }
    } catch { /* Try the independent archive below. */ }
    if (version !== this.version) return false;
    try {
      const list = await getCommonsAudio(scientificName);
      for (const row of list.recordings.slice(0, 2)) {
        if (version !== this.version) return false;
        if (await this.start({ url: row.url, credit: `${row.recordist} · Wikimedia Commons`, pageUrl: row.page_url, licenseUrl: row.license_url }, scientificName, version)) return true;
      }
    } catch { /* Unavailable audio is reported; never replaced by a made-up call. */ }
    if (version === this.version) this.update({ species: scientificName, phase: "error", message: "No playable recording is available right now. The sound archives may be temporarily unavailable." });
    return false;
  }
}

export const birdAudio = new BirdAudioPlayer();
