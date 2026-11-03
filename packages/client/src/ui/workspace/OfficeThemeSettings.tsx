import { lazy, Suspense } from "react";
import type { WorkspaceTheme } from "./workspaceTheme";

const SurfaceMaterialPreview = lazy(() => import("./SurfaceMaterialPreview").then(({ SurfaceMaterialPreview: Preview }) => ({ default: Preview })));

const THEME_CHOICES: readonly { id: WorkspaceTheme; label: string; description: string; colors: readonly string[] }[] = [
  { id: "app", label: "Cosmic dusk", description: "Plum space, starlight, and violet", colors: ["#120B1D", "#21132F", "#F4EDFB", "#9166D8"] },
  { id: "light", label: "Moonlight", description: "Soft lavender, lunar white, and violet", colors: ["#F4EEF9", "#FCF9FF", "#30203F", "#7046A5"] },
  { id: "dark", label: "Deep space", description: "Dark plum, aurora blue, and lilac", colors: ["#0C0715", "#1B1026", "#FAF6FF", "#A57BE9"] },
  { id: "system", label: "System", description: "Follow your device in cosmic colors", colors: ["#F4EEF9", "#21132F", "#F4EDFB", "#68B9CE"] },
];

interface OfficeThemeSettingsProps {
  theme: WorkspaceTheme;
  onThemeChange(theme: WorkspaceTheme): void;
}

export function OfficeThemeSettings({ theme, onThemeChange }: Readonly<OfficeThemeSettingsProps>) {
  return <section aria-labelledby="theme-settings-title" className="office-theme-settings">
    <span className="eyebrow">APPEARANCE</span>
    <h3 id="theme-settings-title">Theme</h3>
    <p className="settings-intro">Choose the colors used across GAMVerse.</p>
    <div className="office-theme-choices" role="group" aria-label="Color theme">
      {THEME_CHOICES.map((choice) => <button key={choice.id} type="button" className={`office-theme-choice${theme === choice.id ? " is-selected" : ""}`} aria-pressed={theme === choice.id} onClick={() => onThemeChange(choice.id)}>
        <span className="office-theme-swatches" aria-hidden="true">{choice.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
        <span className="office-theme-choice-copy"><strong>{choice.label}{choice.id === "app" ? " · Default" : ""}</strong><small>{choice.description}</small></span>
        <span className="office-theme-selected-mark" aria-hidden="true">{theme === choice.id ? "✓" : ""}</span>
      </button>)}
    </div>
    <Suspense fallback={null}><SurfaceMaterialPreview /></Suspense>
  </section>;
}
