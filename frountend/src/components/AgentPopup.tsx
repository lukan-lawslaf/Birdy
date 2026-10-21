import { BirdAudioButton } from "./BirdAudioButton";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RobotHead, type RobotHeadState } from "robot-heads";
import {
  Camera,
  ImagePlus,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert,
  Volume2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  assetUrl,
  agentAsk,
  agentIdentify,
  agentStatus,
  ApiError,
  type AgentAskResponse,
  type AgentStatus,
  type IdentifyAgentResponse,
} from "../lib/api";
import { birdAudio } from "../lib/birdAudio";

/** Palette the brief fixed for the head — shell, trim, screen LEDs. */
const HEAD = {
  shape: "rectangle" as const,
  color: "#737164",
  trimColor: "#214129",
  screenColor: "#7bffff",
};

type Phase = "closed" | "idle" | "identifying" | "result" | "error";

const TONE: Record<string, string> = {
  neutral: "text-[var(--ink)]",
  good: "text-[var(--sage)]",
  warn: "text-[#c4923f]",
  bad: "text-[#c4574f]",
};

const SourceBadge: React.FC<{ source: "model" | "template" | "none" }> = ({ source }) => (
  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--chip)] border border-[var(--line)] text-[var(--muted)]">
    {source === "model" ? "Written by a model" : source === "template" ? "Written from the factsheet" : "No summary"}
  </span>
);

export const AgentPopup: React.FC = () => {
  const [phase, setPhase] = useState<Phase>("closed");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [result, setResult] = useState<IdentifyAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AgentAskResponse | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);

  const headState: RobotHeadState =
    phase === "identifying" || asking
      ? "thinking"
      : phase === "error"
        ? "error"
        : phase === "result"
          ? "happy"
          : "idle";

  useEffect(() => {
    agentStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // Revoke the object URL when the preview is replaced or the popup closes.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const close = () => {
    requestVersion.current += 1;
    setPhase("closed");
    setAsking(false);
    birdAudio.stop();
    requestAnimationFrame(() => launcherRef.current?.focus());
  };

  const isOpen = phase !== "closed";
  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [isOpen]);

  const open = () => {
    if (phase === "closed") setPhase("idle");
    else close();
  };

  const submit = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file, such as a JPEG, PNG or WebP.");
      setPhase("error");
      return;
    }
    const version = ++requestVersion.current;
    setError(null);
    setResult(null);
    setAnswer(null);
    setPreview(URL.createObjectURL(file));
    setPhase("identifying");
    try {
      const response = await agentIdentify(file);
      if (version !== requestVersion.current) return;
      setResult(response);
      setPhase("result");
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err instanceof ApiError ? err.message : "Identification failed.");
      setPhase("error");
    }
  }, []);

  const ask = async () => {
    const target = result?.scientific_name;
    if (!target || question.trim().length < 3) return;
    setAsking(true);
    setError(null);
    const version = requestVersion.current;
    setAnswer(null);
    try {
      const response = await agentAsk(target, question.trim());
      if (version === requestVersion.current) setAnswer(response);
    } catch (err) {
      if (version === requestVersion.current) setError(err instanceof ApiError ? err.message : "Could not answer that.");
    } finally {
      if (version === requestVersion.current) setAsking(false);
    }
  };

  const reset = () => {
    requestVersion.current += 1;
    birdAudio.stop();
    setAsking(false);
    setResult(null);
    setAnswer(null);
    setError(null);
    setPreview(null);
    setQuestion("");
    setPhase("idle");
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const facts = result?.facts;
  const confidence = Math.round((result?.confidence ?? 0) * 100);

  return createPortal(
    <>
      {/* Launcher */}
      <div className="fixed bottom-5 right-4 sm:bottom-7 sm:right-7 z-[60] flex flex-col items-end gap-2">
        <AnimatePresence>
          {phase === "closed" && (
            <motion.button
              ref={launcherRef}
              aria-expanded={isOpen}
              aria-controls="identification-agent"
              key="launcher"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={open}
              aria-label="Open the identification agent"
              className="flex items-center gap-2 px-1.5 sm:pr-4 py-1.5 rounded-full liquid-glass-elevated liquid-bevel text-[var(--ink)] shadow-xl hover:border-[var(--sage)] transition-colors cursor-pointer group"
            >
              <span className="w-11 h-11 -my-1 flex items-center justify-center">
                <RobotHead
                  {...HEAD}
                  size={44}
                  antenna={false}
                  floorShadow={false}
                  state="idle"
                />
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[var(--sage)]" />
                  Identify a bird
                </span>
                <span className="text-[9.5px] font-mono text-[var(--muted)]">
                  Photo · camera · ask
                </span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Panel */}
      <AnimatePresence>
        {phase !== "closed" && (
          <motion.div
            ref={panelRef}
            id="identification-agent"
            role="dialog"
            aria-label="Bird identification agent"
            tabIndex={-1}
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-6 z-[70] sm:w-[400px] max-h-[86vh] rounded-3xl liquid-glass-elevated liquid-bevel shadow-2xl flex flex-col overflow-hidden text-[var(--ink)]"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-3.5 border-b border-[rgba(var(--line-rgb),0.8)] bg-[rgba(var(--panel-rgb),0.6)] backdrop-blur-md">
              <span className="w-12 h-12 flex items-center justify-center shrink-0">
                <RobotHead {...HEAD} size={48} antenna={false} floorShadow={false} state={headState} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold font-display leading-tight">Field Agent</div>
                <div className="text-[10px] font-mono text-[var(--muted)] truncate">
                  {!status
                    ? "Classifier status unavailable"
                    : status.classifier_loaded
                      ? "Bird photo identification · ready"
                      : "Classifier not loaded"}
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Close agent"
                className="p-2 rounded-full liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-4 space-y-4">
              {/* Drop zone / result media */}
              {phase === "idle" || phase === "error" ? (
                <div className="space-y-3">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      submit(e.dataTransfer.files?.[0]);
                    }}
                    className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg)]/60 p-6 text-center space-y-2"
                  >
                    <ImagePlus className="w-6 h-6 text-[var(--sage)] mx-auto" />
                    <p className="text-xs font-semibold">Drop a bird photo here</p>
                    <p className="text-[10.5px] text-[var(--muted)] leading-relaxed">
                      Upload a clear photo to identify the bird and explore its habitat,
                      conservation status and recorded calls.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl liquid-pill-btn text-[var(--sage-ink)] text-xs font-semibold shadow-md cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Upload
                    </button>
                    <button
                      onClick={() => cameraRef.current?.click()}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl liquid-glass-capsule text-xs font-semibold hover:border-[var(--sage)] cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-[var(--sage)]" /> Camera
                    </button>
                  </div>
                  {phase === "error" && error && (
                    <p className="flex items-start gap-2 text-[11px] text-[#c4574f] bg-[#c4574f]/10 border border-[#c4574f]/25 rounded-xl p-2.5">
                      <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--bg)]/60">
                  {preview && (
                    <img src={preview} alt="Your upload" className="w-full h-36 object-cover" />
                  )}
                  {phase === "identifying" && (
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-[11px] font-mono">Classifying…</span>
                    </div>
                  )}
                </div>
              )}

              {/* Identification */}
              {phase === "result" && result && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold font-display leading-tight truncate">
                          {result.is_bird ? result.common_name : "No bird detected"}
                        </h3>
                        {result.is_bird && (
                          <p className="text-[11px] font-mono italic text-[var(--sage)] truncate">
                            {result.scientific_name}
                          </p>
                        )}
                      </div>
                      {result.summary_source !== "none" && (
                        <SourceBadge source={result.summary_source} />
                      )}
                    </div>

                    {result.is_bird && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${result.uncertain ? "bg-[#c4923f]" : "bg-[var(--sage)]"}`}
                            style={{ width: `${Math.max(confidence, 4)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[var(--muted)]">
                          {confidence}% · {result.decided_by}
                        </span>
                      </div>
                    )}

                    {result.uncertain && result.is_bird && (
                      <p className="text-[10.5px] text-[#c4923f] leading-relaxed">
                        The classifier is unsure — treat this name as a suggestion.
                      </p>
                    )}
                  </div>

                  {result.summary && (
                    <p className="text-[12px] leading-relaxed text-[var(--ink)]/90">
                      {result.summary}
                    </p>
                  )}

                  {/* Stat cards */}
                  {facts && facts.cards.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {facts.cards.slice(0, 6).map((card) => (
                        <div
                          key={card.label}
                          className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]"
                        >
                          <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--muted)]">
                            {card.label}
                          </div>
                          <div className={`text-xs font-bold mt-0.5 ${TONE[card.tone] ?? ""}`}>
                            {card.value}
                          </div>
                          {card.hint && (
                            <div className="text-[9px] text-[var(--muted)] mt-0.5 truncate" title={card.hint}>
                              {card.hint}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fact sections */}
                  {facts && facts.sections.length > 0 && (
                    <div className="space-y-2">
                      {facts.sections.map((section) => (
                        <details
                          key={section.title}
                          className="rounded-xl bg-[var(--bg)] border border-[var(--line)] px-3 py-2"
                        >
                          <summary className="text-[11px] font-semibold cursor-pointer">
                            {section.title}
                          </summary>
                          <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-1.5">
                            {section.body}
                          </p>
                        </details>
                      ))}
                    </div>
                  )}

                  {/* Media + profile link */}
                  <div className="flex items-center gap-2">
                    {facts?.media.audio_stream_url && (
                      <BirdAudioButton scientificName={result.scientific_name ?? ""} name={result.common_name ?? undefined} compact />
                    )}
                    {result.scientific_name && (
                      <Link
                        to={`/catalog?q=${encodeURIComponent(result.scientific_name)}`}
                        onClick={close}
                        className="flex-1 text-center px-3 py-2 rounded-full liquid-pill-btn text-[11px] font-semibold text-[var(--sage-ink)] shadow-sm"
                      >
                        Open species record
                      </Link>
                    )}
                  </div>

                  {/* Alternatives */}
                  {result.candidates.length > 1 && (
                    <div className="space-y-1">
                      <div className="text-[9.5px] font-mono uppercase tracking-wider text-[var(--muted)]">
                        Other candidates
                      </div>
                      {result.candidates.slice(1, 4).map((candidate) => (
                        <div
                          key={candidate.label_index}
                          className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg hover:bg-[var(--chip)]"
                        >
                          <span className="truncate">{candidate.common_name}</span>
                          <span className="font-mono text-[var(--muted)] shrink-0 ml-2">
                            {Math.round(candidate.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="space-y-1">
                      {result.warnings.map((warning) => (
                        <p
                          key={warning}
                          className="flex items-start gap-1.5 text-[10px] text-[var(--muted)] leading-relaxed"
                        >
                          <TriangleAlert className="w-3 h-3 mt-0.5 shrink-0 text-[#c4923f]" />
                          <span>{warning}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Ask */}
                  {result.scientific_name && (
                    <div className="pt-3 border-t border-[var(--line)] space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--muted)]">
                        <MessageCircleQuestion className="w-3 h-3 text-[var(--sage)]" />
                        Ask about this species
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && ask()}
                          placeholder="How far does it migrate?"
                          maxLength={500}
                          className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-[11px] focus:outline-none focus:border-[var(--sage)]"
                        />
                        <button
                          onClick={ask}
                          disabled={asking || question.trim().length < 3}
                          aria-label="Ask the agent"
                          className="p-2 rounded-xl liquid-pill-btn text-[var(--sage-ink)] disabled:opacity-40 cursor-pointer"
                        >
                          {asking ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {answer && (
                        <div className="rounded-xl bg-[var(--bg)] border border-[var(--line)] p-2.5 space-y-1">
                          <p className="text-[11px] leading-relaxed">{answer.answer}</p>
                          <p className="text-[9px] font-mono text-[var(--muted)]">
                            {answer.source === "model" ? answer.model : "from the factsheet"} ·
                            grounded in the database only
                          </p>
                        </div>
                      )}
                      {error && phase === "result" && (
                        <p className="text-[10.5px] text-[#c4574f]">{error}</p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={reset}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl liquid-glass-capsule text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--sage)] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Try another photo
                  </button>
                </>
              )}
            </div>

            {/* Hidden inputs */}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => submit(e.target.files?.[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => submit(e.target.files?.[0])}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
