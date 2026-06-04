import { usePreferencesStore } from "@/modules/settings/preferences";

export type AgentSoundStatus =
  | "started"
  | "attention"
  | "finished"
  | "error"
  | "exited"
  | "yolo";

/**
 * Play a status audio notification from `/public/sounds/<status>.wav`
 * if sound effects are enabled.
 */
export function playAgentSound(status: AgentSoundStatus): void {
  const { agentSoundEnabled, agentSoundVolume } = usePreferencesStore.getState();
  if (!agentSoundEnabled) return;

  try {
    const audio = new Audio(`/sounds/${status}.wav`);
    audio.volume = agentSoundVolume;
    audio.play().catch((err) => {
      console.warn(`[opincode] Failed to play sound for status "${status}":`, err);
    });
  } catch (err) {
    console.warn(`[opincode] Failed to play sound/create Audio for "${status}":`, err);
  }
}
