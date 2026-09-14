import { useEffect, useRef } from "react";
import type { SoundEvent } from "@t3tools/contracts/settings";

import { configureSounds, playAppSound } from "../sounds";
import { useClientSettings } from "./useSettings";

/** Keeps the sound module in step with the stored preferences. */
export function useSyncSounds(): void {
  const enabled = useClientSettings((settings) => settings.soundsEnabled);
  const volume = useClientSettings((settings) => settings.soundVolume);
  const cues = useClientSettings((settings) => settings.soundCues);
  useEffect(() => {
    configureSounds({ enabled, volume, cues });
  }, [cues, enabled, volume]);
}

/**
 * Plays a cue when a thread's status changes, without a sound on first sight:
 * a board that announced every thread it already knew about the moment it
 * opened would be unbearable.
 */
export function useThreadStatusSounds(statuses: ReadonlyMap<string, SoundEvent | null>): void {
  const previous = useRef<ReadonlyMap<string, SoundEvent | null> | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = statuses;
    if (before === null) return;
    for (const [key, event] of statuses) {
      if (event === null) continue;
      if (before.get(key) === event) continue;
      // A thread the board has not seen before arrives already finished as
      // often as not; only a change a person could have watched is worth a cue.
      if (!before.has(key)) continue;
      playAppSound(event);
    }
  }, [statuses]);
}
