import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { CAMPUS_WORLD, type RoomLayout } from "@gammyverse/shared";
import { buildZoneMapRegions, locateInZoneMap, zoneMapLocationLabel, zoneMapViewBox } from "./zoneMapModel";
import "./ZoneMapOverlay.css";

const POSITION_POLL_MS = 100;
const LABEL_FONT_FRACTION = 0.0155;
const SEAT_GAP_M = 0.6;
const LEGEND = [
  ["team", "Team seats"],
  ["meeting", "Meeting rooms"],
  ["townhall", "Town Hall"],
  ["common", "Common"],
  ["restroom", "Restroom"],
] as const;

type Props = {
  layout: RoomLayout | null;
  playersRef: MutableRefObject<Map<string, { x: number; z: number }>>;
  localSessionIdRef: MutableRefObject<string | null>;
  onClose: () => void;
};

export function ZoneMapOverlay({ layout, playersRef, localSessionIdRef, onClose }: Props) {
  const regions = useMemo(() => buildZoneMapRegions(layout?.zones ?? []), [layout]);
  const view = zoneMapViewBox(layout, CAMPUS_WORLD);
  const fontSize = view.width * LABEL_FONT_FRACTION;
  const [me, setMe] = useState<{ x: number; z: number } | null>(null);

  useEffect(() => {
    const read = () => {
      const id = localSessionIdRef.current;
      const player = id ? playersRef.current.get(id) : undefined;
      setMe((prev) => (!player ? null : prev && prev.x === player.x && prev.z === player.z ? prev : { x: player.x, z: player.z }));
    };
    read();
    const timer = window.setInterval(read, POSITION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [playersRef, localSessionIdRef]);

  const location = me ? zoneMapLocationLabel(locateInZoneMap(regions, me)) : null;

  return (
    <div className="zone-map-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="zone-map" role="dialog" aria-modal="true" aria-label="Zone map">
        <header className="zone-map-header">
          <h2>Zone map</h2>
          {location && <span className="zone-map-location">You are in: <strong>{location}</strong></span>}
          <button type="button" className="zone-map-close" onClick={onClose} aria-label="Close map">Close · M</button>
        </header>
        <svg className="zone-map-svg" viewBox={`${view.minX} ${view.minZ} ${view.width} ${view.depth}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Office zones">
          <rect className="zone-map-ground" x={view.minX} y={view.minZ} width={view.width} height={view.depth} />
          {regions.map((region) => (
            <g key={region.id} className={`zone-map-region zone-map-${region.category}`}>
              <rect x={region.x - region.width / 2} y={region.z - region.depth / 2} width={region.width} height={region.depth} rx={1.5} />
              {region.seats.map((seat) => (
                <rect key={seat.id} className="zone-map-seat" x={seat.x - seat.width / 2 + SEAT_GAP_M} y={seat.z - seat.depth / 2 + SEAT_GAP_M} width={seat.width - SEAT_GAP_M * 2} height={seat.depth - SEAT_GAP_M * 2} rx={0.8} />
              ))}
              {region.category !== "room" && (
                <text className="zone-map-label" x={region.x} y={region.z - region.depth / 2 + fontSize * 1.1} fontSize={fontSize} textAnchor="middle">{region.label}</text>
              )}
            </g>
          ))}
          {me && (
            <g className="zone-map-me" transform={`translate(${me.x} ${me.z})`}>
              <circle className="zone-map-me-pulse" r={fontSize * 1.1} />
              <circle className="zone-map-me-dot" r={fontSize * 0.55} />
            </g>
          )}
        </svg>
        <footer className="zone-map-legend">
          {LEGEND.map(([category, label]) => <span key={category}><i className={`zone-map-swatch zone-map-${category}`} />{label}</span>)}
          <span><i className="zone-map-swatch zone-map-you" />You</span>
        </footer>
      </section>
    </div>
  );
}
