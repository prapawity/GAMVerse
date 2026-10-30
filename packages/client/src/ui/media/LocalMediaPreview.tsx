import { useEffect, useRef } from "react";
import type { LocalVideoTrack } from "livekit-client";
import "./LocalMediaPreview.css";

export type LocalPreviewSource = "camera" | "screen_share";
export type LocalPreviewTile = { source: LocalPreviewSource; track: LocalVideoTrack };

function LocalPreviewVideo({ tile }: { tile: LocalPreviewTile }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { track, source } = tile;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    track.attach(video);
    return () => { track.detach(video); video.srcObject = null; };
  }, [track]);
  const label = source === "screen_share" ? "Your screen" : "Your camera";
  return <figure className={`local-media-tile is-${source}`}>
    <video ref={videoRef} autoPlay muted playsInline aria-label={`${label} preview`} />
    <figcaption>{label}</figcaption>
  </figure>;
}

/** Small self-view so people can confirm their camera or shared screen is live. */
export function LocalMediaPreview({ tiles }: { tiles: readonly LocalPreviewTile[] }) {
  if (tiles.length === 0) return null;
  return <aside className="local-media-preview" aria-label="Your camera and screen preview" onPointerDown={event => event.stopPropagation()}>
    {tiles.map(tile => <LocalPreviewVideo key={tile.track.sid ?? tile.track.mediaStreamTrack.id} tile={tile} />)}
  </aside>;
}
