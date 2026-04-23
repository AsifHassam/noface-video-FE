"use client";

import React from "react";

const SCENE_STYLES = [
  "fancy-split",
  "fancy-minimal",
  "subtitle-cinema",
  "emphasis-explode",
  "checklist-reveal",
  "question-shrug",
  "ticker-stack",
  "vs-split",
  "quote-card",
  "reaction-burst",
] as const;
const TYPO_STYLES = ["modern-sans", "display-bold", "elegant-serif"] as const;

export type ExplainerSceneStyleId = (typeof SCENE_STYLES)[number];
export type ExplainerTypographyStyleId = (typeof TYPO_STYLES)[number];
export type ExplainerAnimationPace = "normal" | "slow";

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function easeOutCubic(t: number) {
  return 1 - (1 - clamp01(t)) ** 3;
}

function easeInCubic(t: number) {
  return clamp01(t) ** 3;
}

export function beatEnvelope(tRelMs: number, segmentMs: number, enterMs = 420, exitMs = 450) {
  const enter = easeOutCubic(tRelMs / enterMs);
  const exitStart = Math.max(0, segmentMs - exitMs);
  const exit =
    tRelMs <= exitStart ? 1 : 1 - easeOutCubic((tRelMs - exitStart) / exitMs);
  return enter * exit;
}

/**
 * Scene-level transition durations. A short, layered enter (opacity + scale +
 * lift + micro-blur) and a matching exit wrap every card so switching from
 * one scene style to another (circle PiP → 50/50 → black overlay) reads as a
 * deliberate beat change instead of a hard jumpcut.
 */
const SCENE_ENTER_MS = 420;
const SCENE_EXIT_MS = 360;

/**
 * Compute the outer scene transition (opacity + transform + blur).
 * Called for the wrapper shell, NOT for inner per-word animations. The
 * inner `beatEnvelope` still handles staggered text reveals within the scene.
 */
function sceneTransitionStyle(
  tRelMs: number,
  segmentDurationMs: number
): React.CSSProperties {
  const enterP = easeOutCubic(tRelMs / SCENE_ENTER_MS);
  const exitStart = Math.max(0, segmentDurationMs - SCENE_EXIT_MS);
  const exitP =
    tRelMs <= exitStart ? 0 : clamp01((tRelMs - exitStart) / SCENE_EXIT_MS);
  const exitE = easeInCubic(exitP);
  const opacity = enterP * (1 - exitE);
  const scale = (0.97 + 0.03 * enterP) * (1 + 0.035 * exitE);
  const translateY = 14 * (1 - enterP) - 10 * exitE;
  const blurPx = 5 * (1 - enterP) + 3.5 * exitE;
  return {
    opacity,
    transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
    transformOrigin: "center center",
    filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
    willChange: "transform, opacity, filter",
  };
}

function stagger(tMs: number, start: number, duration: number) {
  return easeOutCubic((tMs - start) / duration);
}

const WORD_GAP_MS = 115;
const WORD_IN_MS = 300;
const BEAT_ENTER_MS = 520;
const BEAT_EXIT_MS = 560;
const PACE_SLOW_MULT = 1.85;

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * White card + stock art: shrink type when copy is long so the top band fits without
 * colliding with the illustration (strict grid still clips; this reduces overflow).
 */
function whiteCardStockFontScale(accent: string, title: string, sub: string): number {
  const combined = `${accent} ${title} ${sub}`.trim();
  const chars = combined.length;
  const titleWords = splitWords(title).length;
  let s = 1;
  if (chars >= 140) s = 0.64;
  else if (chars >= 110) s = 0.72;
  else if (chars >= 85) s = 0.8;
  else if (chars >= 60) s = 0.88;
  else if (chars >= 40) s = 0.94;
  if (titleWords >= 12) s *= 0.9;
  else if (titleWords >= 8) s *= 0.94;
  else if (titleWords >= 6) s *= 0.97;
  return Math.max(0.55, s);
}

/** Remove literal ellipses from captions (no "..." on screen). */
function stripCaptionEllipsis(text: string): string {
  return text
    .replace(/\u2026/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function AnimatedWords({
  text,
  tRelMs,
  cap,
  startMs,
  wordGapMs = WORD_GAP_MS,
  wordDuration = WORD_IN_MS,
}: {
  text: string;
  tRelMs: number;
  cap: (p: number) => number;
  startMs: number;
  wordGapMs?: number;
  wordDuration?: number;
}) {
  const words = splitWords(text);
  if (words.length === 0) return null;
  return (
    <span
      className="inline-flex flex-wrap justify-center gap-x-[0.28em] gap-y-1"
      style={{ textAlign: "center" }}
    >
      {words.map((word, i) => {
        const p = stagger(tRelMs, startMs + i * wordGapMs, wordDuration);
        return (
          <span
            key={`${i}-${word.slice(0, 12)}`}
            className="inline-block"
            style={{
              opacity: cap(p),
              transform: `translateY(${(1 - p) * 0.22}em)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

const KARAOKE_WORDS_VISIBLE = 3;
/** >1 eases the highlight forward (early words dwell longer; still reaches the last word on time). */
const KARAOKE_TIME_POWER = 1.32;
const KARAOKE_TIME_POWER_SLOW = 1.5;

/** Maps segment clock to karaoke progress (sublinear = slower perceived stepping vs linear). */
function karaokeProgress(linearT: number, pace: ExplainerAnimationPace) {
  const t = clamp01(linearT);
  const power = pace === "slow" ? KARAOKE_TIME_POWER_SLOW : KARAOKE_TIME_POWER;
  return clamp01(t ** power);
}

/** Black overlay: exactly 3 words (or fewer at start/end), active word centered when possible. */
function KaraokeThreeWordSubtitle({
  text,
  tRelMs,
  segmentDurationMs,
  cap,
  fontFamily,
  fontSize,
  animationPace,
  linearKaraoke,
}: {
  text: string;
  tRelMs: number;
  segmentDurationMs: number;
  cap: (p: number) => number;
  fontFamily: string;
  fontSize: number;
  animationPace: ExplainerAnimationPace;
  /** When true, progress tracks speech evenly (no slow-ramp easing) — use with caption-synced timings. */
  linearKaraoke?: boolean;
}) {
  const words = splitWords(stripCaptionEllipsis(text));
  if (words.length === 0) return null;

  const total = words.length;
  const linearT = tRelMs / Math.max(segmentDurationMs, 1);
  const progress = linearKaraoke
    ? clamp01(linearT)
    : karaokeProgress(linearT, animationPace);
  const rawIdx = Math.min(total - 1, Math.max(0, Math.floor(progress * total)));
  const pulseT = progress * total - rawIdx;
  const pulse = 1 + 0.12 * (1 - Math.abs(pulseT - 0.5) * 2);

  const w = Math.min(KARAOKE_WORDS_VISIBLE, total);
  const maxStart = Math.max(0, total - w);
  const start = Math.min(maxStart, Math.max(0, rawIdx - 1));
  const visible = words.slice(start, start + w);
  const activeLocal = rawIdx - start;

  return (
    <span
      className="inline-flex max-w-full flex-wrap justify-center gap-x-[0.28em]"
      style={{ lineHeight: 1.2 }}
    >
      {visible.map((word, i) => {
        const active = i === activeLocal;
        return (
          <span
            key={`${start + i}-${word.slice(0, 14)}`}
            className="inline-block"
            style={{
              fontFamily,
              fontSize,
              fontWeight: active ? 900 : 700,
              color: active ? "#fff176" : "#ffffff",
              opacity: cap(active ? 1 : 0.9),
              transform: active ? `scale(${pulse})` : "scale(1)",
              transition: "transform 140ms ease-out, color 140ms ease-out",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

function slugKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function resolveExplainerSceneStyle(raw: string | undefined, fallbackIndex: number): ExplainerSceneStyleId {
  const slug = slugKey(raw || "");
  if (SCENE_STYLES.includes(slug as ExplainerSceneStyleId)) return slug as ExplainerSceneStyleId;
  return SCENE_STYLES[((fallbackIndex % SCENE_STYLES.length) + SCENE_STYLES.length) % SCENE_STYLES.length]!;
}

export function resolveExplainerTypographyStyle(
  raw: string | undefined,
  fallbackIndex: number
): ExplainerTypographyStyleId {
  const slug = slugKey(raw || "");
  if (TYPO_STYLES.includes(slug as ExplainerTypographyStyleId)) return slug as ExplainerTypographyStyleId;
  return TYPO_STYLES[((fallbackIndex % TYPO_STYLES.length) + TYPO_STYLES.length) % TYPO_STYLES.length]!;
}

const TYPO_FONT: Record<ExplainerTypographyStyleId, string> = {
  "modern-sans": 'var(--font-montserrat), ui-sans-serif, system-ui, sans-serif',
  "display-bold": 'var(--font-bebas-neue), Impact, sans-serif',
  "elegant-serif": 'Georgia, "Times New Roman", Times, serif',
};

/** Small floating brand logo rendered by any scene when card.logoUrl is set. */
function LogoBadge({
  src,
  tRelMs,
  sizePx,
  onDark,
}: {
  src: string;
  tRelMs: number;
  sizePx: number;
  onDark?: boolean;
}) {
  const enter = easeOutCubic(tRelMs / 420);
  return (
    <div
      className="pointer-events-none absolute right-[5%] top-[5%] z-[3] flex items-center justify-center"
      style={{
        width: sizePx,
        height: sizePx,
        borderRadius: "22%",
        background: onDark ? "rgba(255,255,255,0.96)" : "#ffffff",
        boxShadow: onDark
          ? "0 8px 28px rgba(0,0,0,0.35)"
          : "0 6px 22px rgba(0,0,0,0.12)",
        opacity: enter,
        transform: `scale(${0.6 + 0.4 * enter}) rotate(${(1 - enter) * -6}deg)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="block h-[70%] w-[70%] object-contain"
        draggable={false}
      />
    </div>
  );
}

/**
 * Large topic-emoji accent for fancy-* / subtitle-cinema / emphasis-explode /
 * ticker-stack / question-shrug scenes. Pops in with spring overshoot, then
 * gently floats to feel alive. Pure emoji — no assets, no network calls.
 */
function IconAccent({
  emoji,
  tRelMs,
  sizePx,
  position = "top-right",
  onDark,
}: {
  emoji: string;
  tRelMs: number;
  sizePx: number;
  position?: "top-right" | "top-center" | "center-side" | "above-title";
  onDark?: boolean;
}) {
  const enter = easeOutCubic(Math.max(0, tRelMs) / 320);
  const overshoot = 1 + 0.18 * Math.sin(Math.min(1, tRelMs / 260) * Math.PI);
  const bobY = Math.sin(tRelMs / 520) * (sizePx * 0.05);
  const tilt = (1 - enter) * -10;
  const scale = (0.3 + 0.7 * enter) * overshoot;

  const positionClass =
    position === "top-center"
      ? "left-1/2 top-[5%] -translate-x-1/2"
      : position === "center-side"
        ? "right-[4%] top-1/2 -translate-y-1/2"
        : position === "above-title"
          ? "left-1/2 top-[14%] -translate-x-1/2"
          : "right-[4%] top-[5%]";

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-[2] flex select-none items-center justify-center ${positionClass}`}
      style={{
        fontSize: sizePx,
        lineHeight: 1,
        opacity: enter,
        transform: `translateY(${bobY}px) scale(${scale}) rotate(${tilt}deg)`,
        filter: onDark
          ? `drop-shadow(0 ${Math.round(sizePx * 0.04)}px ${Math.round(sizePx * 0.12)}px rgba(0,0,0,0.45))`
          : `drop-shadow(0 ${Math.round(sizePx * 0.04)}px ${Math.round(sizePx * 0.1)}px rgba(0,0,0,0.18))`,
      }}
    >
      {emoji}
    </div>
  );
}

export type MagicSceneExplainerGraphicProps = {
  sceneStyle?: string;
  typographyStyle?: string;
  accentHex?: string;
  title: string;
  subline?: string;
  accentLabel?: string;
  /** Freepik (or any HTTPS) preview — drawn inside the card so it is not covered by the white panel */
  stockImageUrl?: string;
  tRelMs: number;
  segmentDurationMs: number;
  masterOpacity?: number;
  titleColor?: string;
  widthPct: number;
  fontSizeBase?: number;
  /** Fallback index when sceneStyle missing */
  beatIndex?: number;
  /** Longer gaps and beat fade when "slow" */
  animationPace?: ExplainerAnimationPace;
  /**
   * When set (subtitle-cinema + STT sync), word karaoke uses these instead of `tRelMs` / `segmentDurationMs`,
   * while the beat fade still uses `tRelMs` from the explainer layer start.
   */
  karaokeTRelMs?: number;
  karaokeSegmentDurationMs?: number;
  /** True when karaoke timings follow the active caption line (linear word progress). */
  cinemaCaptionSync?: boolean;
  /** emphasis-explode: single-word punchline drawn oversized. */
  heroWord?: string;
  /** checklist-reveal + ticker-stack: short line items. */
  items?: string[];
  /** reaction-burst: single emoji (or short emoji pair) to explode in. */
  emoji?: string;
  /** vs-split: left-side short label. */
  sideA?: string;
  /** vs-split: right-side short label. */
  sideB?: string;
  /**
   * Contextual topic emoji — rendered BIG as a motion accent on fancy-* /
   * subtitle-cinema / emphasis-explode / ticker-stack / question-shrug cards
   * when set. Kept separate from `emoji` (which is the hero of reaction-burst).
   */
  iconEmoji?: string;
  /** Logo.dev PNG URL, floated as a small accent on any scene when set. */
  logoUrl?: string;
};

/**
 * Public entry: wraps every scene in a SceneTransitionShell so scene switches
 * (circle PiP → 50/50 → black overlay) animate in/out instead of hard-cutting.
 * The inner component keeps the original per-style body untouched.
 */
export function MagicSceneExplainerGraphic(props: MagicSceneExplainerGraphicProps) {
  const shellStyle = sceneTransitionStyle(props.tRelMs, props.segmentDurationMs);
  return (
    <div
      className="relative h-full w-full"
      style={shellStyle}
    >
      <MagicSceneExplainerGraphicInner {...props} />
    </div>
  );
}

function MagicSceneExplainerGraphicInner({
  sceneStyle,
  typographyStyle,
  accentHex = "#6366f1",
  title,
  subline,
  accentLabel,
  stockImageUrl,
  tRelMs,
  segmentDurationMs,
  masterOpacity = 1,
  titleColor = "#0a0a0a",
  widthPct,
  fontSizeBase = 20,
  beatIndex = 0,
  animationPace = "normal",
  karaokeTRelMs: karaokeTRelMsProp,
  karaokeSegmentDurationMs: karaokeSegmentDurationMsProp,
  cinemaCaptionSync = false,
  heroWord,
  items,
  emoji,
  sideA,
  sideB,
  iconEmoji,
  logoUrl,
}: MagicSceneExplainerGraphicProps) {
  const style = resolveExplainerSceneStyle(sceneStyle, beatIndex);
  const typo = resolveExplainerTypographyStyle(typographyStyle, beatIndex);
  const accent = /^#[0-9A-Fa-f]{6}$/.test(accentHex || "") ? accentHex! : "#6366f1";
  const fontFamily = TYPO_FONT[typo];

  const paceMult = animationPace === "slow" ? PACE_SLOW_MULT : 1;
  const wordGapMs = WORD_GAP_MS * paceMult;
  const wordInMs = WORD_IN_MS * paceMult;

  const scale = widthPct / 64;
  const heroPx = Math.max(
    style === "subtitle-cinema" ? 12 : 18,
    fontSizeBase * scale * (typo === "display-bold" ? 1.35 : typo === "elegant-serif" ? 1.05 : 1.12)
  );
  const cinemaKaraokePx =
    style === "subtitle-cinema" ? Math.max(9, heroPx * 0.56) : heroPx;
  const subPx = Math.max(11, heroPx * (style === "subtitle-cinema" ? 0.36 : 0.48));
  const hookPx = Math.max(10, heroPx * 0.4);
  const isCinema = style === "subtitle-cinema";

  /** Cinema overlay stays solid for the full segment; only ease words in (no end fade). */
  const beat = isCinema
    ? Math.min(1, easeOutCubic(tRelMs / (BEAT_ENTER_MS * paceMult)))
    : beatEnvelope(
        tRelMs,
        segmentDurationMs,
        BEAT_ENTER_MS * paceMult,
        BEAT_EXIT_MS * paceMult
      );
  const cap = (p: number) => p * masterOpacity * beat;

  const accentText = accentLabel?.trim() ?? "";
  const titleText = title.trim();
  const subText = subline?.trim() ?? "";
  const accentW = accentText ? splitWords(accentText).length : 0;
  const titleW = splitWords(titleText).length;
  const accentTailMs = 56 * paceMult;
  const subPauseMs = 96 * paceMult;
  const accentBlockMs = accentW > 0 ? accentW * wordGapMs + accentTailMs : 0;
  const titleStartMs = accentBlockMs;
  const subStartMs = titleStartMs + Math.max(titleW, 1) * wordGapMs + subPauseMs;

  const headlineColor = isCinema ? "#ffffff" : titleColor;
  const subColor = isCinema ? "rgba(255,255,255,0.82)" : "rgba(10,10,10,0.72)";
  const hookColor = isCinema ? "rgba(255,255,255,0.9)" : accent;

  const headlineStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: typo === "display-bold" ? 400 : typo === "elegant-serif" ? 700 : 800,
    lineHeight: typo === "display-bold" ? 0.95 : 1.12,
    letterSpacing: typo === "display-bold" ? "0.02em" : "-0.02em",
    textTransform: typo === "display-bold" ? "uppercase" : "none",
    color: headlineColor,
    fontSize: heroPx,
    textAlign: "center",
    textShadow: isCinema ? "0 2px 24px rgba(0,0,0,0.35)" : "0 1px 0 rgba(255,255,255,0.6)",
  };

  const stockSrc = stockImageUrl?.trim();
  const showStock = Boolean(stockSrc && /^https?:\/\//i.test(stockSrc));

  const stockFontScale = showStock && !isCinema ? whiteCardStockFontScale(accentText, titleText, subText) : 1;
  const heroCard = heroPx * stockFontScale;
  const subCard = subPx * stockFontScale;
  const hookCard = hookPx * stockFontScale;
  const headlineStyleCard: React.CSSProperties = {
    ...headlineStyle,
    fontSize: heroCard,
  };

  const karaokeRel = karaokeTRelMsProp ?? tRelMs;
  const karaokeDur = karaokeSegmentDurationMsProp ?? segmentDurationMs;

  const logoOk = Boolean(logoUrl && /^https?:\/\//i.test(logoUrl));
  const logoSizePx = Math.max(28, heroPx * 1.35);
  // Contextual topic emoji. Suppressed when a brand logo is present
  // (brand wins) or when a Freepik stock visual already fills the card.
  const iconOk = Boolean(
    iconEmoji && iconEmoji.trim().length > 0 && !logoOk && !showStock
  );
  const iconText = (iconEmoji || "").trim();
  const iconBigPx = Math.max(42, heroPx * 3.0);
  const iconMedPx = Math.max(32, heroPx * 2.1);

  // ── emphasis-explode ──────────────────────────────────────────────────
  // One hero word explodes in (spring scale + soft shake). Headline karaokes beneath.
  if (style === "emphasis-explode") {
    const heroWordText = (heroWord || splitWords(titleText)[0] || titleText).toUpperCase();
    const heroEnter = easeOutCubic(tRelMs / (BEAT_ENTER_MS * paceMult * 0.7));
    const overshoot = 1 + 0.18 * Math.sin(Math.min(1, tRelMs / 260) * Math.PI);
    const heroScale = (0.3 + 0.7 * heroEnter) * overshoot;
    const shakeAmp = Math.max(0, 1 - tRelMs / 420) * 3;
    const shakeX = Math.sin(tRelMs / 22) * shakeAmp;
    const shakeY = Math.cos(tRelMs / 18) * shakeAmp * 0.6;
    const heroPxBig = heroPx * 2.4;
    const subVisible = stagger(tRelMs, 380, 520);

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-none"
        style={{ background: "#0b0b14" }}>
        {/* accent halo */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: heroPxBig * 3.2,
            height: heroPxBig * 3.2,
            background: `radial-gradient(circle, ${accent}33 0%, transparent 65%)`,
            opacity: cap(heroEnter),
          }}
        />
        {/* burst lines */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rp = stagger(tRelMs, 120 + i * 30, 360);
          return (
            <div
              key={deg}
              className="pointer-events-none absolute left-1/2 top-1/2"
              style={{
                width: 3,
                height: heroPxBig * (0.55 + 0.15 * (i % 3)),
                background: accent,
                opacity: cap(rp) * (1 - rp) * 0.9,
                transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${heroPxBig * (0.9 + 0.3 * rp)}px)`,
                borderRadius: 2,
              }}
            />
          );
        })}
        <div className="relative z-[1] flex w-full flex-col items-center justify-center gap-3 px-4 text-center">
          <h2
            style={{
              ...headlineStyle,
              color: "#ffffff",
              fontSize: heroPxBig,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              transform: `translate(${shakeX}px, ${shakeY}px) scale(${heroScale})`,
              textShadow: `0 0 28px ${accent}66, 0 8px 30px rgba(0,0,0,0.55)`,
              opacity: cap(heroEnter),
            }}
          >
            {heroWordText}
          </h2>
          {accentText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 800,
                fontSize: hookPx,
                color: accent,
                margin: 0,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: cap(subVisible),
              }}
            >
              {accentText}
            </p>
          ) : null}
          {subText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 600,
                fontSize: subPx,
                color: "rgba(255,255,255,0.82)",
                margin: 0,
                maxWidth: "min(92%, 40rem)",
                opacity: cap(subVisible),
                transform: `translateY(${(1 - subVisible) * 10}px)`,
              }}
            >
              {subText}
            </p>
          ) : null}
        </div>
        {logoOk ? (
          <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} onDark />
        ) : iconOk ? (
          <IconAccent emoji={iconText} tRelMs={tRelMs} sizePx={iconMedPx} position="top-right" onDark />
        ) : null}
      </div>
    );
  }

  // ── checklist-reveal ──────────────────────────────────────────────────
  // 2–5 items stamp in with ticks, staggered. Headline sits at the top.
  if (style === "checklist-reveal") {
    const list = (items && items.length > 0
      ? items
      : subText.split(/[;•\n]|\.\s+/).map((s) => s.trim()).filter(Boolean)
    )
      .slice(0, 5)
      .map((s) => s.replace(/^[-*\u2022\s]+/, "").trim());
    const itemStartMs = titleStartMs + Math.max(titleW, 1) * wordGapMs + 80;
    const itemStepMs = 180 * paceMult;
    const itemFontPx = Math.max(13, heroPx * 0.62);
    const tickPx = Math.max(18, itemFontPx * 1.1);

    return (
      <div className="relative flex h-full w-full flex-col items-start justify-center overflow-hidden rounded-none bg-white px-[6%] py-[4%]">
        {accentText ? (
          <p
            style={{
              fontFamily: TYPO_FONT["modern-sans"],
              fontWeight: 800,
              fontSize: hookPx,
              color: accent,
              margin: 0,
              marginBottom: 8,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <AnimatedWords text={accentText} tRelMs={tRelMs} cap={cap} startMs={0} wordGapMs={wordGapMs} wordDuration={wordInMs} />
          </p>
        ) : null}
        <h2
          style={{
            ...headlineStyle,
            margin: 0,
            marginBottom: 12,
            textAlign: "left",
            fontSize: heroPx * 0.92,
          }}
        >
          <AnimatedWords text={titleText} tRelMs={tRelMs} cap={cap} startMs={titleStartMs} wordGapMs={wordGapMs} wordDuration={wordInMs} />
        </h2>
        <ul className="relative z-[1] flex w-full flex-col gap-[0.45em]" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.map((it, i) => {
            const p = stagger(tRelMs, itemStartMs + i * itemStepMs, 320);
            const stampScale = 0.75 + 0.25 * p;
            return (
              <li
                key={`${i}-${it.slice(0, 12)}`}
                className="flex items-center gap-3"
                style={{
                  opacity: cap(p),
                  transform: `translateX(${(1 - p) * -10}px)`,
                }}
              >
                <span
                  aria-hidden
                  className="inline-flex shrink-0 items-center justify-center"
                  style={{
                    width: tickPx,
                    height: tickPx,
                    borderRadius: "50%",
                    background: accent,
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: tickPx * 0.62,
                    transform: `scale(${stampScale})`,
                    boxShadow: `0 6px 18px ${accent}55`,
                  }}
                >
                  ✓
                </span>
                <span
                  style={{
                    fontFamily: TYPO_FONT["modern-sans"],
                    fontWeight: 700,
                    fontSize: itemFontPx,
                    color: "#111827",
                    lineHeight: 1.25,
                  }}
                >
                  {it}
                </span>
              </li>
            );
          })}
        </ul>
        {logoOk ? <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} /> : null}
      </div>
    );
  }

  // ── question-shrug ────────────────────────────────────────────────────
  // Huge animated "?" sits behind the question; headline karaokes forward.
  if (style === "question-shrug") {
    const qPulse = 1 + 0.08 * Math.sin(tRelMs / 220);
    const qTilt = Math.sin(tRelMs / 380) * 4;
    const qEnter = easeOutCubic(tRelMs / (BEAT_ENTER_MS * paceMult));
    const qPx = heroPx * 4.2;

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-none"
        style={{ background: `linear-gradient(145deg, ${accent}22 0%, #ffffff 70%)` }}>
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{
            fontFamily: TYPO_FONT["display-bold"],
            fontSize: qPx,
            color: accent,
            opacity: cap(qEnter) * 0.22,
            transform: `translate(-50%, -50%) rotate(${qTilt}deg) scale(${qPulse * (0.6 + 0.4 * qEnter)})`,
            lineHeight: 1,
            fontWeight: 400,
          }}
        >
          ?
        </div>
        <div className="relative z-[1] mx-auto flex w-full max-w-[min(100%,44rem)] flex-col items-center px-6 text-center">
          {accentText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 800,
                fontSize: hookPx,
                color: accent,
                margin: 0,
                marginBottom: 6,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <AnimatedWords text={accentText} tRelMs={tRelMs} cap={cap} startMs={0} wordGapMs={wordGapMs} wordDuration={wordInMs} />
            </p>
          ) : null}
          <h2 style={{ ...headlineStyle, margin: 0 }}>
            <AnimatedWords text={titleText} tRelMs={tRelMs} cap={cap} startMs={titleStartMs} wordGapMs={wordGapMs} wordDuration={wordInMs} />
          </h2>
          {subText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 600,
                fontSize: subPx,
                color: subColor,
                margin: 0,
                marginTop: 10,
              }}
            >
              <AnimatedWords text={subText} tRelMs={tRelMs} cap={cap} startMs={subStartMs} wordGapMs={wordGapMs} wordDuration={wordInMs} />
            </p>
          ) : null}
        </div>
        {logoOk ? (
          <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} />
        ) : iconOk ? (
          <IconAccent emoji={iconText} tRelMs={tRelMs} sizePx={iconMedPx} position="top-center" />
        ) : null}
      </div>
    );
  }

  // ── ticker-stack ──────────────────────────────────────────────────────
  // Rapid vertical cascade of short phrases (no ticks). Each item slides in
  // from the right with a micro-scale pop, staggered ~120ms.
  if (style === "ticker-stack") {
    const list = (items && items.length > 0
      ? items
      : splitWords(subText).length > 0
        ? subText.split(/[,.;\n]| and /i).map((s) => s.trim()).filter(Boolean)
        : []
    )
      .slice(0, 5)
      .map((s) => s.replace(/^[-*\u2022\s]+/, "").trim());
    const itemStartMs = titleStartMs + Math.max(titleW, 1) * wordGapMs + 60;
    const itemStepMs = 130 * paceMult;
    const itemFontPx = Math.max(16, heroPx * 0.95);

    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-none"
        style={{ background: `linear-gradient(160deg, #0f172a 0%, #111827 55%, ${accent}22 100%)` }}
      >
        {/* subtle scanline */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 6px)`,
            mixBlendMode: "overlay",
          }}
        />
        <div className="relative z-[1] mx-auto flex w-full max-w-[min(100%,42rem)] flex-col items-center gap-[0.35em] px-6">
          {accentText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 800,
                fontSize: hookPx,
                color: accent,
                margin: 0,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              <AnimatedWords text={accentText} tRelMs={tRelMs} cap={cap} startMs={0} wordGapMs={wordGapMs} wordDuration={wordInMs} />
            </p>
          ) : null}
          {titleText.length > 0 ? (
            <h2
              style={{
                ...headlineStyle,
                color: "#ffffff",
                margin: 0,
                marginBottom: 6,
                fontSize: heroPx * 0.9,
              }}
            >
              <AnimatedWords text={titleText} tRelMs={tRelMs} cap={cap} startMs={titleStartMs} wordGapMs={wordGapMs} wordDuration={wordInMs} />
            </h2>
          ) : null}
          <div className="flex w-full flex-col items-center gap-[0.25em]">
            {list.map((it, i) => {
              const p = stagger(tRelMs, itemStartMs + i * itemStepMs, 280);
              const pop = 0.88 + 0.12 * p;
              return (
                <div
                  key={`${i}-${it.slice(0, 12)}`}
                  style={{
                    fontFamily: TYPO_FONT[typo],
                    fontWeight: typo === "display-bold" ? 400 : 800,
                    fontSize: itemFontPx,
                    color: "#ffffff",
                    letterSpacing: typo === "display-bold" ? "0.04em" : "-0.01em",
                    textTransform: typo === "display-bold" ? "uppercase" : "none",
                    lineHeight: 1.05,
                    opacity: cap(p),
                    transform: `translateX(${(1 - p) * 40}px) scale(${pop})`,
                    textShadow: `0 2px 18px ${accent}55`,
                  }}
                >
                  {it}
                </div>
              );
            })}
          </div>
        </div>
        {logoOk ? (
          <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} onDark />
        ) : iconOk ? (
          <IconAccent emoji={iconText} tRelMs={tRelMs} sizePx={iconMedPx} position="top-right" onDark />
        ) : null}
      </div>
    );
  }

  // ── vs-split ──────────────────────────────────────────────────────────
  // Two colored halves slide in from opposite sides. "VS" badge stamps in
  // the center after both labels land.
  if (style === "vs-split") {
    const aLabel = (sideA || splitWords(titleText)[0] || "A").toUpperCase();
    const bLabel = (sideB || splitWords(titleText).slice(-1)[0] || "B").toUpperCase();
    const aEnter = easeOutCubic(tRelMs / 420);
    const bEnter = easeOutCubic((tRelMs - 120) / 420);
    const vsEnter = easeOutCubic((tRelMs - 420) / 320);
    const vsPulse = 1 + 0.08 * Math.sin((tRelMs - 420) / 180);
    const labelPx = heroPx * 1.7;
    // Slightly warm/cool accent pair — sideB derived from accent hue.
    const aBg = "#111827";
    const bBg = accent;

    return (
      <div className="relative flex h-full w-full overflow-hidden rounded-none">
        {/* Side A */}
        <div
          className="relative flex h-full flex-col items-center justify-center overflow-hidden"
          style={{
            width: "50%",
            background: aBg,
            transform: `translateX(${(1 - aEnter) * -40}%)`,
            opacity: cap(aEnter),
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 60%)`,
            }}
          />
          <div
            style={{
              fontFamily: TYPO_FONT["display-bold"],
              fontSize: labelPx,
              color: "#ffffff",
              fontWeight: 400,
              letterSpacing: "0.04em",
              textAlign: "center",
              padding: "0 8%",
              lineHeight: 1,
            }}
          >
            {aLabel}
          </div>
        </div>
        {/* Side B */}
        <div
          className="relative flex h-full flex-col items-center justify-center overflow-hidden"
          style={{
            width: "50%",
            background: bBg,
            transform: `translateX(${(1 - bEnter) * 40}%)`,
            opacity: cap(bEnter),
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 70% 60%, rgba(255,255,255,0.12) 0%, transparent 60%)`,
            }}
          />
          <div
            style={{
              fontFamily: TYPO_FONT["display-bold"],
              fontSize: labelPx,
              color: "#ffffff",
              fontWeight: 400,
              letterSpacing: "0.04em",
              textAlign: "center",
              padding: "0 8%",
              lineHeight: 1,
              textShadow: "0 2px 12px rgba(0,0,0,0.25)",
            }}
          >
            {bLabel}
          </div>
        </div>
        {/* VS badge */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            width: heroPx * 2.1,
            height: heroPx * 2.1,
            borderRadius: "50%",
            background: "#ffffff",
            color: "#0a0a0a",
            fontFamily: TYPO_FONT["display-bold"],
            fontSize: heroPx * 0.95,
            fontWeight: 400,
            letterSpacing: "0.02em",
            boxShadow: `0 12px 40px rgba(0,0,0,0.35), 0 0 0 ${Math.max(2, heroPx * 0.08)}px ${accent}`,
            opacity: cap(vsEnter),
            transform: `translate(-50%, -50%) scale(${(0.4 + 0.6 * vsEnter) * vsPulse})`,
            zIndex: 2,
          }}
        >
          VS
        </div>
        {/* optional headline banner at top */}
        {titleText && titleText !== `${aLabel} ${bLabel}` && titleText.length <= 40 ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[7%] -translate-x-1/2"
            style={{
              fontFamily: TYPO_FONT["modern-sans"],
              fontWeight: 800,
              fontSize: hookPx * 1.1,
              color: "#ffffff",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textAlign: "center",
              maxWidth: "80%",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              opacity: cap(Math.min(aEnter, bEnter)),
            }}
          >
            {titleText}
          </div>
        ) : null}
        {logoOk ? <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} onDark /> : null}
      </div>
    );
  }

  // ── quote-card ────────────────────────────────────────────────────────
  // Giant opening quote mark, italic quote body, attribution eyebrow.
  if (style === "quote-card") {
    const quoteMarkEnter = easeOutCubic(tRelMs / 360);
    const quoteBodyEnter = stagger(tRelMs, 280, 540);
    const attribEnter = stagger(tRelMs, titleStartMs + Math.max(titleW, 1) * wordGapMs + 120, 420);
    const quoteMarkPx = heroPx * 4.8;
    const quotePx = heroPx * 0.95;
    const attribText = accentText;

    return (
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-none"
        style={{ background: `linear-gradient(135deg, #faf7f2 0%, #ffffff 50%, ${accent}14 100%)` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute select-none"
          style={{
            left: "6%",
            top: "-5%",
            fontFamily: "Georgia, serif",
            fontSize: quoteMarkPx,
            color: accent,
            opacity: cap(quoteMarkEnter) * 0.32,
            lineHeight: 1,
            transform: `scale(${0.7 + 0.3 * quoteMarkEnter}) rotate(${(1 - quoteMarkEnter) * -4}deg)`,
            transformOrigin: "top left",
          }}
        >
          &ldquo;
        </div>
        <div className="relative z-[1] flex w-full max-w-[min(92%,40rem)] flex-col items-start gap-4 px-[8%] text-left">
          <p
            style={{
              fontFamily: TYPO_FONT["elegant-serif"],
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: quotePx,
              lineHeight: 1.25,
              color: "#0a0a0a",
              margin: 0,
              opacity: cap(quoteBodyEnter),
              transform: `translateY(${(1 - quoteBodyEnter) * 10}px)`,
            }}
          >
            {titleText}
          </p>
          {attribText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 700,
                fontSize: hookPx,
                color: accent,
                margin: 0,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: cap(attribEnter),
              }}
            >
              {/^[\u2014\u2013-]/.test(attribText) ? attribText : `— ${attribText}`}
            </p>
          ) : null}
          {subText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 500,
                fontSize: subPx,
                color: subColor,
                margin: 0,
                opacity: cap(attribEnter),
              }}
            >
              {subText}
            </p>
          ) : null}
        </div>
        {logoOk ? <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} /> : null}
      </div>
    );
  }

  // ── reaction-burst ────────────────────────────────────────────────────
  // A huge emoji pops with radial particles. Headline (if any) slides in below.
  if (style === "reaction-burst") {
    const reactEmoji = (emoji || "✨").slice(0, 6);
    const popEnter = easeOutCubic(tRelMs / 280);
    const overshoot = 1 + 0.22 * Math.sin(Math.min(1, tRelMs / 220) * Math.PI);
    const popScale = (0.2 + 0.8 * popEnter) * overshoot;
    const popTilt = (1 - popEnter) * -12;
    const emojiPx = heroPx * 3.6;
    const subEnter = stagger(tRelMs, 360, 520);

    return (
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-none"
        style={{ background: `radial-gradient(circle at 50% 50%, ${accent}33 0%, #0b0b14 70%)` }}
      >
        {/* particle ring */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
          const rp = stagger(tRelMs, 80 + i * 22, 420);
          const travel = emojiPx * (0.85 + 0.25 * ((i * 7) % 3));
          return (
            <div
              key={deg}
              className="pointer-events-none absolute left-1/2 top-1/2"
              style={{
                width: Math.max(4, emojiPx * 0.05),
                height: Math.max(4, emojiPx * 0.05),
                borderRadius: "50%",
                background: i % 2 === 0 ? accent : "#ffffff",
                opacity: cap(rp) * (1 - rp) * 0.9,
                transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${travel * rp}px)`,
              }}
            />
          );
        })}
        <div className="relative z-[1] flex w-full flex-col items-center gap-3 px-6 text-center">
          <div
            style={{
              fontSize: emojiPx,
              lineHeight: 1,
              opacity: cap(popEnter),
              transform: `scale(${popScale}) rotate(${popTilt}deg)`,
              filter: `drop-shadow(0 12px 40px ${accent}88)`,
              userSelect: "none",
            }}
            aria-hidden
          >
            {reactEmoji}
          </div>
          {titleText ? (
            <h2
              style={{
                ...headlineStyle,
                color: "#ffffff",
                margin: 0,
                fontSize: heroPx * 0.95,
                opacity: cap(subEnter),
                transform: `translateY(${(1 - subEnter) * 14}px)`,
                textShadow: `0 2px 20px ${accent}66`,
              }}
            >
              {titleText}
            </h2>
          ) : null}
          {subText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 600,
                fontSize: subPx,
                color: "rgba(255,255,255,0.78)",
                margin: 0,
                maxWidth: "min(92%, 40rem)",
                opacity: cap(subEnter),
              }}
            >
              {subText}
            </p>
          ) : null}
        </div>
        {logoOk ? <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} onDark /> : null}
      </div>
    );
  }

  if (isCinema) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-none">
        <div
          className="absolute inset-0 rounded-none"
          style={{
            background: "rgba(0,0,0,0.92)",
            WebkitBackdropFilter: "blur(18px)",
            backdropFilter: "blur(18px)",
          }}
        />
        <div className="relative z-[1] flex max-h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
          <h2
            style={{
              ...headlineStyle,
              margin: 0,
              width: "100%",
              maxWidth: "min(92%, 44rem)",
              textTransform: "none",
              letterSpacing: "-0.01em",
            }}
          >
            <KaraokeThreeWordSubtitle
              text={titleText}
              tRelMs={karaokeRel}
              segmentDurationMs={karaokeDur}
              cap={cap}
              fontFamily={TYPO_FONT["modern-sans"]}
              fontSize={cinemaKaraokePx}
              animationPace={animationPace}
              linearKaraoke={cinemaCaptionSync}
            />
          </h2>
        </div>
      </div>
    );
  }

  if (style === "fancy-minimal") {
    if (!showStock) {
      return (
        <div
          className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-none bg-white px-6"
        >
          {logoOk ? (
            <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} />
          ) : iconOk ? (
            <IconAccent emoji={iconText} tRelMs={tRelMs} sizePx={iconBigPx} position="above-title" />
          ) : null}
          <div className="relative z-[1] mx-auto flex w-full max-w-[min(100%,42rem)] flex-col items-center text-center"
            style={{ marginTop: iconOk ? iconBigPx * 0.55 : 0 }}>
            {accentText ? (
              <p
                style={{
                  fontFamily: TYPO_FONT["modern-sans"],
                  fontWeight: 800,
                  fontSize: hookPx,
                  color: accent,
                  margin: 0,
                  marginBottom: 6,
                }}
              >
                <AnimatedWords
                  text={accentText}
                  tRelMs={tRelMs}
                  cap={cap}
                  startMs={0}
                  wordGapMs={wordGapMs}
                  wordDuration={wordInMs}
                />
              </p>
            ) : null}
            <h2 style={{ ...headlineStyle, margin: 0 }}>
              <AnimatedWords
                text={titleText}
                tRelMs={tRelMs}
                cap={cap}
                startMs={titleStartMs}
                wordGapMs={wordGapMs}
                wordDuration={wordInMs}
              />
            </h2>
            {subText ? (
              <p
                style={{
                  fontFamily: TYPO_FONT["modern-sans"],
                  fontWeight: 600,
                  fontSize: subPx,
                  color: subColor,
                  maxWidth: "100%",
                  margin: 0,
                  marginTop: 10,
                }}
              >
                <AnimatedWords
                  text={subText}
                  tRelMs={tRelMs}
                  cap={cap}
                  startMs={subStartMs}
                  wordGapMs={wordGapMs}
                  wordDuration={wordInMs}
                />
              </p>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <div className="grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-none bg-white">
        <div className="relative z-[2] min-h-0 overflow-hidden border-b border-neutral-200/80 bg-white">
          <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-5 py-3">
            <div
              className="mx-auto flex w-full max-w-[min(100%,42rem)] flex-col items-center break-words text-center"
              style={{ overflowWrap: "anywhere" }}
            >
              {accentText ? (
                <p
                  style={{
                    fontFamily: TYPO_FONT["modern-sans"],
                    fontWeight: 800,
                    fontSize: hookCard,
                    color: accent,
                    margin: 0,
                    marginBottom: 5,
                  }}
                >
                  <AnimatedWords
                    text={accentText}
                    tRelMs={tRelMs}
                    cap={cap}
                    startMs={0}
                    wordGapMs={wordGapMs}
                    wordDuration={wordInMs}
                  />
                </p>
              ) : null}
              <h2 style={{ ...headlineStyleCard, margin: 0 }}>
                <AnimatedWords
                  text={titleText}
                  tRelMs={tRelMs}
                  cap={cap}
                  startMs={titleStartMs}
                  wordGapMs={wordGapMs}
                  wordDuration={wordInMs}
                />
              </h2>
              {subText ? (
                <p
                  style={{
                    fontFamily: TYPO_FONT["modern-sans"],
                    fontWeight: 600,
                    fontSize: subCard,
                    color: subColor,
                    maxWidth: "100%",
                    margin: 0,
                    marginTop: 8,
                    lineHeight: 1.25,
                  }}
                >
                  <AnimatedWords
                    text={subText}
                    tRelMs={tRelMs}
                    cap={cap}
                    startMs={subStartMs}
                    wordGapMs={wordGapMs}
                    wordDuration={wordInMs}
                  />
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="relative z-[1] min-h-0 overflow-hidden bg-white">
          <div className="flex h-full min-h-0 flex-col items-center justify-end px-4 pb-3 pt-2">
            <img
              src={stockSrc}
              alt=""
              className="max-h-[min(100%,16rem)] w-auto max-w-[min(92%,20rem)] object-contain object-bottom drop-shadow-sm"
              draggable={false}
            />
          </div>
        </div>
      </div>
    );
  }

  // fancy-split — white panel with optional illustration band below copy
  if (!showStock) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-none bg-white">
        {logoOk ? (
          <LogoBadge src={logoUrl!} tRelMs={tRelMs} sizePx={logoSizePx} />
        ) : iconOk ? (
          <IconAccent emoji={iconText} tRelMs={tRelMs} sizePx={iconBigPx} position="above-title" />
        ) : null}
        <div className="relative z-[1] mx-auto flex w-full max-w-[min(100%,42rem)] flex-col items-center px-6 text-center"
          style={{ marginTop: iconOk ? iconBigPx * 0.55 : 0 }}>
          {accentText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 800,
                fontSize: hookPx * 0.95,
                color: accent,
                margin: 0,
                marginBottom: 4,
              }}
            >
              <AnimatedWords
                text={accentText}
                tRelMs={tRelMs}
                cap={cap}
                startMs={0}
                wordGapMs={wordGapMs}
                wordDuration={wordInMs}
              />
            </p>
          ) : null}
          <h2 style={{ ...headlineStyle, margin: 0 }}>
            <AnimatedWords
              text={titleText}
              tRelMs={tRelMs}
              cap={cap}
              startMs={titleStartMs}
              wordGapMs={wordGapMs}
              wordDuration={wordInMs}
            />
          </h2>
          {subText ? (
            <p
              style={{
                fontFamily: TYPO_FONT["modern-sans"],
                fontWeight: 600,
                fontSize: subPx,
                color: subColor,
                maxWidth: "100%",
                margin: 0,
                marginTop: 8,
              }}
            >
              <AnimatedWords
                text={subText}
                tRelMs={tRelMs}
                cap={cap}
                startMs={subStartMs}
                wordGapMs={wordGapMs}
                wordDuration={wordInMs}
              />
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-none bg-white">
      <div className="relative z-[2] min-h-0 overflow-hidden border-b border-neutral-200/80 bg-white">
        <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-5 py-3">
          <div
            className="mx-auto flex w-full max-w-[min(100%,42rem)] flex-col items-center break-words text-center"
            style={{ overflowWrap: "anywhere" }}
          >
            {accentText ? (
              <p
                style={{
                  fontFamily: TYPO_FONT["modern-sans"],
                  fontWeight: 800,
                  fontSize: hookCard * 0.95,
                  color: accent,
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                <AnimatedWords
                  text={accentText}
                  tRelMs={tRelMs}
                  cap={cap}
                  startMs={0}
                  wordGapMs={wordGapMs}
                  wordDuration={wordInMs}
                />
              </p>
            ) : null}
            <h2 style={{ ...headlineStyleCard, margin: 0 }}>
              <AnimatedWords
                text={titleText}
                tRelMs={tRelMs}
                cap={cap}
                startMs={titleStartMs}
                wordGapMs={wordGapMs}
                wordDuration={wordInMs}
              />
            </h2>
            {subText ? (
              <p
                style={{
                  fontFamily: TYPO_FONT["modern-sans"],
                  fontWeight: 600,
                  fontSize: subCard,
                  color: subColor,
                  maxWidth: "100%",
                  margin: 0,
                  marginTop: 8,
                  lineHeight: 1.25,
                }}
              >
                <AnimatedWords
                  text={subText}
                  tRelMs={tRelMs}
                  cap={cap}
                  startMs={subStartMs}
                  wordGapMs={wordGapMs}
                  wordDuration={wordInMs}
                />
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="relative z-[1] min-h-0 overflow-hidden bg-white">
        <div className="flex h-full min-h-0 flex-col items-center justify-end px-4 pb-3 pt-2">
          <img
            src={stockSrc}
            alt=""
            className="max-h-[min(100%,16rem)] w-auto max-w-[min(92%,20rem)] object-contain object-bottom drop-shadow-sm"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
