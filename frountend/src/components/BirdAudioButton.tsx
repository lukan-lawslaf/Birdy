import { useSyncExternalStore } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { birdAudio } from "../lib/birdAudio";

export function BirdAudioButton({ scientificName, name, compact = false }: {
  scientificName: string; name?: string; compact?: boolean;
}) {
  const playback = useSyncExternalStore(birdAudio.subscribe, birdAudio.getSnapshot);
  const own = playback.species === scientificName;
  const loading = own && playback.phase === "loading";
  const playing = own && playback.phase === "playing";
  const active = loading || playing;
  const error = own && playback.phase === "error" ? playback.message : null;
  return (
    <span className={`relative ${compact ? "inline-flex" : "flex flex-col gap-1.5 w-full"}`}>
      <button type="button"
        onClick={(event) => { event.stopPropagation(); if (active) birdAudio.stop(); else void birdAudio.playRecording(scientificName); }}
        aria-label={active ? `Stop recording of ${name ?? scientificName}` : `Listen to recording of ${name ?? scientificName}`}
        aria-pressed={active}
        title={error ?? (loading ? "Loading recording… Click to cancel" : playing ? "Stop recording" : "Listen to a real field recording")}
        className={`inline-flex items-center justify-center gap-2 rounded-full border transition-colors cursor-pointer ${compact ? "p-2" : "px-3 py-2 text-xs font-semibold"} ${active ? "bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage)]" : "liquid-glass-capsule text-[var(--ink)] hover:border-[var(--sage)]"}`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : playing ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        {!compact && <span>{loading ? "Loading recording…" : playing ? "Stop recording" : "Listen to recorded call"}</span>}
      </button>
      {own && playback.recording && (
        <span className={`${compact ? "absolute right-0 top-full mt-2 w-56 p-2 rounded-lg bg-[var(--panel)] shadow-lg border border-[var(--line)] z-40" : ""} text-[11px] leading-relaxed text-[var(--muted)]`}>
          <a href={playback.recording.pageUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{playback.recording.credit}</a>
          {" · "}<a href={playback.recording.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Licence</a>
        </span>
      )}
      {error && <span role="status" className={`${compact ? "absolute right-0 top-full mt-2 w-56 p-2 rounded-lg bg-[var(--panel)] shadow-lg border border-[var(--line)] z-40" : ""} text-[11px] leading-relaxed text-[#b47732]`}>{error}</span>}
    </span>
  );
}
