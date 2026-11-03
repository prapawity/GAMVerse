import { createRoomPropSupportIndex, roomPropDefinition, type RoomLayout, type RoomLayoutProp } from "@gammyverse/shared";
import { shouldRenderDistanceCulledProp } from "../propDistanceCulling";
import { drawMap2dProp } from "./map2dPropDrawing";
import { worldToScreen, type Map2dProjection } from "./map2dProjection";
import { map2dWallDrawItems, map2dWallLayoutIndex, type Map2dActorPoint } from "./map2dWallDrawing";
import { map2dPropModelImages } from "./map2dPropModelImages";
import { pruneMap2dPropLod } from "./map2dPropLod";
import { map2dDoorProgress, pruneMap2dDoorAnimations } from "./map2dDoorAnimation";
import { withMap2dPropWallClip } from "./map2dPropWallClip";
import type { Map2dSceneActor } from "./map2dDynamicLayer";
import { coveredZones, isInsideZone } from "../zoneVisibility";

const MODEL_SPRITE_HEIGHT_PROJECTION_RATIO = 0.62;
const MAP2D_ACTOR_OVERLAY_RENDER_DISTANCE_M = 60;
const propDistanceVisibility = new Map<string, boolean>();
const supportIndexByProps = new WeakMap<readonly RoomLayoutProp[], ReturnType<typeof createRoomPropSupportIndex>>();

function cachedSupportIndex(props: readonly RoomLayoutProp[]): ReturnType<typeof createRoomPropSupportIndex> {
  const cached = supportIndexByProps.get(props);
  if (cached) return cached;
  const index = createRoomPropSupportIndex(props);
  supportIndexByProps.set(props, index);
  return index;
}

type DrawItem = { depth: number; elevation: number; order: number; draw(actors: readonly Map2dActorPoint[]): void };
type Map2dZoneVisibility = { editing: boolean; editProps: boolean; currentPrivateZoneId?: string | null };

/** Draw wall segments and props in world depth order so foreground walls occlude furniture. */
export function drawMap2dSceneOverlay(
  ctx: CanvasRenderingContext2D,
  projection: Map2dProjection,
  props: readonly RoomLayoutProp[],
  layout: RoomLayout | null,
  actors: readonly Map2dSceneActor[] = [],
  nowMs = performance.now(),
  distanceFocus?: { x: number; z: number },
  zoneVisibility: Map2dZoneVisibility = { editing: false, editProps: false },
): boolean {
  map2dPropModelImages.beginFrame();
  const currentPropIds = new Set(props.map(prop => prop.id));
  pruneMap2dPropLod(currentPropIds);
  for (const id of propDistanceVisibility.keys()) if (!currentPropIds.has(id)) propDistanceVisibility.delete(id);
  const items: DrawItem[] = [];
  const actorPoints = actors.map(({ x, z, local }) => ({ x, z, local }));
  const localActor = actorPoints.find(actor => actor.local);
  // Match the 3D renderer: normal play follows the local character, while
  // editor views use their camera focus supplied by the caller.
  const renderFocus = distanceFocus ?? localActor ?? projection.center;
  const zones = layout?.zones ?? [];
  const covered = coveredZones(zones, localActor, zoneVisibility.editing);
  const privateRoom = zoneVisibility.editProps
    ? zones.find(zone => zone.kind === "private" && isInsideZone(renderFocus, zone))
    : !zoneVisibility.editing && zoneVisibility.currentPrivateZoneId
      ? zones.find(zone => zone.id === zoneVisibility.currentPrivateZoneId && zone.kind === "private")
      : undefined;
  const doors = layout?.doors ?? [];
  pruneMap2dDoorAnimations(new Set(doors.map(door => door.id)));
  const doorProgress = new Map<string, number>();
  let doorAnimationActive = false;
  const wallsById = layout ? map2dWallLayoutIndex(layout).wallsById : null;
  if (layout) for (const door of doors) {
    const wall = wallsById?.get(door.wallId);
    if (!wall || door.kind === "opening") continue;
    const progress = map2dDoorProgress(door.id,
      wall.x + (wall.axis === "horizontal" ? door.offset : 0),
      wall.z + (wall.axis === "vertical" ? door.offset : 0), actorPoints, nowMs);
    doorProgress.set(door.id, progress.progress);
    doorAnimationActive ||= progress.animating;
  }
  for (const wall of layout ? map2dWallDrawItems(layout, doorProgress) : []) {
    items.push({ depth: wall.depth, elevation: 0, order: 0, draw: actors => wall.draw(ctx, projection, actors) });
  }
  const hasElevatedProps = props.some(prop => (prop.elevation ?? 0) > 0);
  const supportIndex = hasElevatedProps
    ? cachedSupportIndex(layout?.props ?? props)
    : null;
  for (const prop of props) {
    if (covered.some(zone => isInsideZone(prop, zone)) || (privateRoom && !isInsideZone(prop, privateRoom))) continue;
    const visibleByDistance = shouldRenderDistanceCulledProp(prop, renderFocus,
      propDistanceVisibility.get(prop.id) ?? true);
    propDistanceVisibility.set(prop.id, visibleByDistance);
    if (!visibleByDistance) continue;
    const widthPx = prop.width * projection.pxPerM;
    const depthPx = prop.depth * projection.pxPerM;

    const center = worldToScreen(projection, prop);
    const cosine = Math.abs(Math.cos(prop.rotation));
    const sine = Math.abs(Math.sin(prop.rotation));
    const halfWidthPx = (cosine * prop.width + sine * prop.depth) * projection.pxPerM / 2;
    const halfDepthPx = (sine * prop.width + cosine * prop.depth) * projection.pxPerM / 2;
    const definition = roomPropDefinition(prop.asset);
    const elevationPx = (prop.elevation ?? 0) * projection.pxPerM;
    const liftPx = (definition?.height ?? 0) * MODEL_SPRITE_HEIGHT_PROJECTION_RATIO * projection.pxPerM;
    if (center.x + halfWidthPx < 0 || center.x - halfWidthPx > projection.widthPx
      || center.y - elevationPx + halfDepthPx < 0
      || center.y - elevationPx - halfDepthPx - liftPx > projection.heightPx) continue;

    const support = (prop.elevation ?? 0) > 0
      ? supportIndex?.find(prop.asset, prop.x, prop.z, prop.rotation, prop.id) ?? null
      : null;
    items.push({ depth: support?.prop.z ?? prop.z, elevation: prop.elevation ?? 0, order: 1,
      draw: () => withMap2dPropWallClip(ctx, projection, prop,
        definition?.wallMounted ? null : layout,
        () => drawMap2dProp(ctx, projection, prop)) });
  }
  for (const actor of actors) {
    const dx = actor.x - projection.center.x;
    const dz = actor.z - projection.center.z;
    if (dx * dx + dz * dz > MAP2D_ACTOR_OVERLAY_RENDER_DISTANCE_M * MAP2D_ACTOR_OVERLAY_RENDER_DISTANCE_M) continue;
    items.push({ depth: actor.z, elevation: actor.elevation ?? 0, order: 2, draw: () => actor.draw(ctx, projection) });
  }
  items.sort((a, b) => a.depth - b.depth || a.elevation - b.elevation || a.order - b.order);
  for (const item of items) item.draw(actorPoints);
  return doorAnimationActive;
}
