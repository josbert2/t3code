import type { SoundCue, SoundEvent } from "@t3tools/contracts/settings";
import { PlayIcon } from "lucide-react";

import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import { useSyncSounds } from "../../hooks/useSounds";
import {
  DEFAULT_SOUND_CUES,
  previewSoundCue,
  SOUND_EVENT_LABELS,
  SOUND_EVENTS,
} from "../../sounds";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { SettingsRow, SettingsSection } from "./settingsLayout";

/** Every cue the library offers, in the order it lists them. */
const SOUND_CUES: ReadonlyArray<SoundCue> = [
  "chime",
  "sparkle",
  "droplet",
  "bloom",
  "whisper",
  "tick",
  "press",
  "release",
  "toggle",
  "success",
  "error",
  "page",
  "loading",
  "ready",
  "pulse",
  "scan",
  "arrival",
];

const MUTED_VALUE = "__muted__";

/** Sentence case for a cue name, which is how the picker reads best. */
function cueLabel(cue: SoundCue): string {
  return cue.charAt(0).toUpperCase() + cue.slice(1);
}

function SoundEventRow({ event }: { event: SoundEvent }) {
  const cues = useClientSettings((settings) => settings.soundCues);
  const updateSettings = useUpdateClientSettings();
  const stored = cues[event];
  const current = stored === undefined ? DEFAULT_SOUND_CUES[event] : stored;

  const choose = (value: string | null) => {
    // The select clears to null when it closes without a pick; only an actual
    // choice should rewrite the setting.
    if (value === null) return;
    updateSettings({
      soundCues: { ...cues, [event]: value === MUTED_VALUE ? null : (value as SoundCue) },
    });
  };

  return (
    <SettingsRow
      title={SOUND_EVENT_LABELS[event]}
      control={
        <div className="flex items-center gap-2">
          <Select value={current ?? MUTED_VALUE} onValueChange={choose}>
            <SelectTrigger
              size="sm"
              className="w-full sm:w-40"
              aria-label={`Sound for ${SOUND_EVENT_LABELS[event]}`}
            >
              <SelectValue>{current === null ? "Silent" : cueLabel(current)}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              <SelectItem hideIndicator value={MUTED_VALUE}>
                Silent
              </SelectItem>
              {SOUND_CUES.map((cue) => (
                <SelectItem hideIndicator key={cue} value={cue}>
                  {cueLabel(cue)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={current === null}
            aria-label={`Play ${SOUND_EVENT_LABELS[event]}`}
            onClick={() => {
              if (current !== null) previewSoundCue(current);
            }}
          >
            <PlayIcon className="size-3.5" />
          </Button>
        </div>
      }
    />
  );
}

export function SoundSettingsPanel() {
  // The panel is where someone auditions cues, so it keeps the module in step
  // even when the board that normally does it is not mounted.
  useSyncSounds();
  const enabled = useClientSettings((settings) => settings.soundsEnabled);
  const volume = useClientSettings((settings) => settings.soundVolume);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsSection id="sounds" title="Sounds">
      <SettingsRow
        title="Play interaction sounds"
        description="Synthesized on the spot, so nothing is downloaded and nothing is stored."
        control={
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => updateSettings({ soundsEnabled: Boolean(checked) })}
          />
        }
      />
      <SettingsRow
        title="Volume"
        control={
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={!enabled}
              aria-label="Sound volume"
              onChange={(quantity) =>
                updateSettings({ soundVolume: Number(quantity.currentTarget.value) })
              }
              className="w-40 accent-primary disabled:opacity-40"
            />
            <span className="w-10 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
              {Math.round(volume * 100)}%
            </span>
          </div>
        }
      />
      {SOUND_EVENTS.map((event) => (
        <SoundEventRow key={event} event={event} />
      ))}
    </SettingsSection>
  );
}
