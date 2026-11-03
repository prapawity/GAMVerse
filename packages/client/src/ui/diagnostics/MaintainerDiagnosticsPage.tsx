import { MaintainerDiagnosticsPanel } from "./MaintainerDiagnosticsPanel";
import { BrandMark } from "../BrandMark";
import { BrandWordmark } from "../BrandWordmark";
import { MaintainerWorkspaceNav } from "../MaintainerWorkspaceNav";

export function MaintainerDiagnosticsPage({ endpoint, allowed }: { endpoint: string; allowed: boolean }) {
  return <main className="lobby-shell diagnostics-page">
    <header className="diagnostics-topbar">
      <a className="diagnostics-brand" href="/maintainer" aria-label="GAMVerse maintainer overview"><BrandMark /><BrandWordmark /></a>
      <span className="diagnostics-access">Maintainer workspace</span>
    </header>
    <div className="diagnostics-content">
      <MaintainerWorkspaceNav section="diagnostics" />
      <div className="diagnostics-intro"><span className="diagnostics-retention">7-day history</span></div>
    {allowed ? <MaintainerDiagnosticsPanel endpoint={endpoint} /> : <section className="lobby-panel">
      <p role="alert">Platform maintainer access is required to view diagnostics.</p>
    </section>}
    </div>
  </main>;
}
