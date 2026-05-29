import { DEFAULT_THEME_ID, type Theme } from "../types";
import { caffeine } from "./caffeine";
import { catppuccin } from "./catppuccin";
import { claude } from "./claude";
import { dracula } from "./dracula";
import { everforest } from "./everforest";
import { github } from "./github";
import { gruvbox } from "./gruvbox";
import { nord } from "./nord";
import { opincodeDefault } from "./opincode-default";
import { rosePine } from "./rose-pine";
import { sage } from "./sage";
import { synthwave84 } from "./synthwave84";
import { tide } from "./tide";
import { tokyoNight } from "./tokyo-night";
import { vesper } from "./vesper";

const BUILTIN: Theme[] = [
  opincodeDefault,
  claude,
  github,
  tokyoNight,
  dracula,
  nord,
  tide,
  vesper,
  synthwave84,
  sage,
  everforest,
  catppuccin,
  gruvbox,
  rosePine,
  caffeine,
];

const BY_ID = new Map<string, Theme>(BUILTIN.map((t) => [t.id, t]));

export function listBuiltinThemes(): Theme[] {
  return BUILTIN;
}

export function getBuiltinTheme(id: string): Theme | undefined {
  return BY_ID.get(id);
}

export function getDefaultTheme(): Theme {
  return BY_ID.get(DEFAULT_THEME_ID) ?? BUILTIN[0];
}
