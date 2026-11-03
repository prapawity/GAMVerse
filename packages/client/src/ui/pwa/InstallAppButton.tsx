import type { PwaInstallState } from "./usePwaInstall";

export function InstallAppButton({ canInstall, promptInstall, className = "" }: PwaInstallState & { className?: string }) {
  if (!canInstall) return null;
  return (
    <button className={`install-app-button ${className}`.trim()} type="button" onClick={() => void promptInstall()}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 16v4h14v-4" />
      </svg>
      <span>Install GAMVerse</span>
    </button>
  );
}
