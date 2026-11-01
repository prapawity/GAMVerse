import type { ReactNode } from "react";
import type { UserStatus } from "@gammyverse/shared";
import { AVAILABILITY_OPTIONS } from "./AvailabilityPresentation";
import "./Availability.css";

const AVAILABILITY_LABEL = "Availability";
export type AvailabilityMenuProps = {
  status: UserStatus;
  disabled?: boolean;
  excludeAvailable?: boolean;
  onStatusChange(status: UserStatus): void;
};

function StatusIcon({ status }: { status: UserStatus }) {
  const paths: Record<UserStatus, ReactNode> = {
    available: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    "do-not-disturb": <><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></>,
    "in-meeting": <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5h8v2m-13 5h18"/></>,
    away: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    toilet: <><path d="M5 4h5v6H5zm9 0h5v6h-5zM4 14h16l-2 6H6z"/></>,
    lunch: <><path d="M6 3v7m3-7v7M6 7h3m-1.5 3v11M16 3v18m0-18c3 2 3 6 0 8"/></>,
    "coffee-break": <><path d="M5 8h12v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zm12 2h2a2 2 0 0 1 0 4h-2M8 4c0 1 1 1 1 2m4-2c0 1 1 1 1 2"/></>,
  };
  return <svg className={`availability-status-icon status-${status}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[status]}</svg>;
}

export function AvailabilityMenu({ status, disabled, excludeAvailable = false, onStatusChange }: AvailabilityMenuProps) {
  return <div className="availability-menu">
    <span className="availability-menu-label">{AVAILABILITY_LABEL}</span>
    <div className="availability-status-options" role="group" aria-label={AVAILABILITY_LABEL}>
      {AVAILABILITY_OPTIONS.filter((option) => !excludeAvailable || option.value !== "available").map((option) => <button key={option.value} type="button" className={`availability-status-option${status === option.value ? " is-selected" : ""}`} disabled={disabled} aria-pressed={status === option.value} onClick={() => onStatusChange(option.value)}>
        <StatusIcon status={option.value} /><span>{option.label}</span>{status === option.value && <span className="availability-status-check" aria-hidden="true">✓</span>}
      </button>)}
    </div>
  </div>;
}
