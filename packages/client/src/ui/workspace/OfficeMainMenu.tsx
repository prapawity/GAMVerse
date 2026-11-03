import { useId, useState } from "react";
import { BrandMark } from "../BrandMark";
import { WorkspaceDialog } from "./WorkspaceDialog";

interface OfficeMainMenuProps {
  offices: readonly { id: string; name: string }[];
  currentOfficeId: string;
  onSwitchOffice(id: string): void;
  onOpenChange?(open: boolean): void;
}

export function OfficeMainMenu({ offices, currentOfficeId, onSwitchOffice, onOpenChange }: OfficeMainMenuProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogId = useId();
  const changeOpen = (next: boolean) => { setOpen(next); onOpenChange?.(next); };
  return <>
    <button type="button" className="office-rail-brand office-main-menu-trigger" aria-label="Open office menu" title="Open office menu"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined} onClick={() => changeOpen(true)}><BrandMark /></button>
    {open && <WorkspaceDialog labelledBy={titleId} onClose={() => changeOpen(false)}>
      <section id={dialogId} className="office-main-menu">
        <header><h2 id={titleId}>Main menu</h2><button type="button" aria-label="Close main menu" onClick={() => changeOpen(false)}>×</button></header>
        <h3>Your offices</h3>
        <div className="office-switcher-list" aria-label="Switch office">
          {offices.length === 0 && <p>No offices available.</p>}
          {offices.map(office => <button type="button" key={office.id} aria-current={office.id === currentOfficeId ? "location" : undefined}
            onClick={() => { changeOpen(false); if (office.id !== currentOfficeId) onSwitchOffice(office.id); }}>
            <span>{office.name}</span>{office.id === currentOfficeId && <small>Current office</small>}
          </button>)}
        </div>
      </section>
    </WorkspaceDialog>}
  </>;
}
