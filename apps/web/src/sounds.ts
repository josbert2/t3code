import { play, setEnabled, setVolume } from "cuelume";
import type { SoundCue, SoundEvent } from "@t3tools/contracts/settings";

/**
 * Interaction sounds.
 *
 * The cues are synthesized rather than loaded, so this ships no audio and the
 * first sound costs nothing but the oscillator that makes it. Preferences live
 * in client settings; this module only holds the last ones it was handed, so
 * a caller in a hot path never has to read a store to make a noise.
 */

export const DEFAULT_SOUND_CUES: Readonly<Record<SoundEvent, SoundCue>> = {
  "card-moved": "tick",
  "card-pinned": "toggle",
  "card-unpinned": "release",
  "thread-done": "success",
  "thread-attention": "chime",
  "thread-failed": "error",
};

export const SOUND_EVENT_LABELS: Readonly<Record<SoundEvent, string>> = {
  "card-moved": "Card moved to another column",
  "card-pinned": "Card pinned to a column",
  "card-unpinned": "Card released back to its own state",
  "thread-done": "Thread finished",
  "thread-attention": "Thread needs you",
  "thread-failed": "Thread failed",
};

export const SOUND_EVENTS = Object.keys(DEFAULT_SOUND_CUES) as ReadonlyArray<SoundEvent>;

interface SoundConfig {
  readonly enabled: boolean;
  readonly volume: number;
  readonly cues: Readonly<Record<string, SoundCue | null>>;
}

let config: SoundConfig = { enabled: false, volume: 0.4, cues: {} };

/** Hands the module the current preferences. Safe to call on every render. */
export function configureSounds(next: SoundConfig): void {
  config = next;
  setEnabled(next.enabled);
  setVolume(next.volume);
}

/**
 * The cue an event plays, or null when that one moment is muted. An event with
 * no stored entry falls back to its default rather than going silent, so a
 * fresh install sounds like something once sound is turned on.
 */
export function resolveSoundCue(event: SoundEvent): SoundCue | null {
  const stored = config.cues[event];
  return stored === undefined ? DEFAULT_SOUND_CUES[event] : stored;
}

/** Plays what the event is set to. A no-op while sound is off. */
export function playAppSound(event: SoundEvent): void {
  if (!config.enabled) return;
  const cue = resolveSoundCue(event);
  if (cue === null) return;
  play(cue);
}

/**
 * Plays a cue for the settings picker, ignoring the master switch: someone
 * auditioning sounds has already said they want to hear one.
 */
export function previewSoundCue(cue: SoundCue): void {
  setEnabled(true);
  play(cue);
  setEnabled(config.enabled);
}
