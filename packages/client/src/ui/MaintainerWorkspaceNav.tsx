import "./MaintainerWorkspaceNav.css";

export type MaintainerWorkspaceSection = "overview" | "offices" | "platform" | "diagnostics";

const sections: { id: MaintainerWorkspaceSection; label: string; href: string }[] = [
  { id: "overview", label: "Overview", href: "/maintainer" },
  { id: "offices", label: "Offices & people", href: "/maintainer/offices" },
  { id: "platform", label: "Platform controls", href: "/maintainer/platform" },
  { id: "diagnostics", label: "Diagnostics", href: "/maintainer/diagnostics" },
];

const sectionCopy: Record<MaintainerWorkspaceSection, { title: string; description: string }> = {
  overview: { title: "Platform overview", description: "A quick view of service health and workspace activity." },
  offices: { title: "Offices & people", description: "Manage offices, invitations, accounts, and activity history." },
  platform: { title: "Platform controls", description: "Set which editing tools are available across GAMVerse." },
  diagnostics: { title: "Runtime diagnostics", description: "Inspect performance and connection issues across offices." },
};

export function MaintainerWorkspaceNav({ section }: { section: MaintainerWorkspaceSection }) {
  const copy = sectionCopy[section];
  return <>
    <header className="maintainer-workspace-heading">
      <span className="eyebrow">PLATFORM ADMINISTRATION</span>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
    </header>
    <nav className="maintainer-workspace-nav" aria-label="Maintainer sections">
      {sections.map((item) => <a key={item.id} href={item.href} aria-current={section === item.id ? "page" : undefined}>
        <span>{item.label}</span>
      </a>)}
    </nav>
  </>;
}
