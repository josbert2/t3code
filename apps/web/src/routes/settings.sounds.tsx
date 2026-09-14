import { createFileRoute } from "@tanstack/react-router";

import { SoundSettingsPanel } from "../components/settings/SoundSettingsPanel";

function SettingsSoundsRoute() {
  return <SoundSettingsPanel />;
}

export const Route = createFileRoute("/settings/sounds")({
  component: SettingsSoundsRoute,
});
