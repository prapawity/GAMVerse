import type { Map2dPresentation } from "./map2dPresentation";
import { drawMap2dRoomLabels } from "./map2dRoomLabels";
import { ROOM_PROP_CATALOG, type RoomLayout, type RoomLayoutProp } from "@gammyverse/shared";
import {
  MAP2D_COLORS,
  MAP2D_VIEW_STORAGE_KEY,
} from "./constants";
import { Map2dPlayerFrames } from "./map2dPlayerFrames";
import { Map2dFrameChanges, writeMap2dFollowProjection } from "./map2dFrameChanges";
import {
  drawMap2dDynamic,
  drawMap2dInteraction,
  drawMap2dDestination,
  type Map2dDecoration,
  type Map2dPlayer,
} from "./map2dDynamicLayer";
import { isMap2dDrag, pickMap2dPlayer } from "./map2dInput";
import { Map2dStaticLayer } from "./map2dStaticLayer";
import { AvatarPortraits } from "./avatarPortraits";
import { PetSpriteAtlases } from "./petSpriteAtlases";
import {
  map2dWheelScale,
  screenToWorld,
  type Map2dPoint,
  type Map2dProjection,
  type ScreenPoint,
} from "./map2dProjection";
import type { DomeEntry } from "../proximityGroupShape";
import { drawMap2dProximityDomes } from "./map2dProximityDome";
import { drawMap2dSceneOverlay } from "./map2dSceneOverlay";
import { map2dPropModelImages } from "./map2dPropModelImages";
import { propPreviewImages } from "./propPreviewImages";
import { map2dRestingPlayers } from "./map2dRestingPlayers";
import { petSpriteAnimationRedrawDue } from "./petSpriteGeometry";
export interface Map2dListener {
  pan(center: Map2dPoint): void;
  zoom(pxPerM: number): void;
  zoomOverview(deltaYPx: number): void;
  walk(destination: Map2dPoint): void;
  selectPlayer(sessionId: string, screenX: number, screenY: number): void;
}
export type Map2dFrame = {
  presentation?: Map2dPresentation;
  editing?: boolean;
  editProps?: boolean;
  currentPrivateZoneId?: string | null;
  visible: boolean;
  view: "2d" | "3d";
  layout: RoomLayout | null;
  widthM: number;
  depthM: number;
  configVersion: number;
  projection: Map2dProjection;
  players: ReadonlyMap<string, Map2dPlayer>;
  localId: string | null;
  speaking: ReadonlySet<string>;
  decorations: readonly Map2dDecoration[];
  nowMs: number;
  idleAnimationsEnabled?: boolean;
  reduceMotion?: boolean;
  deltaS: number;
  destination?: Map2dPoint | null;
  proximityDomes?: readonly DomeEntry[];
  following?: boolean;
};
export function readMap2dPreference(): boolean {
  try {
    return localStorage.getItem(MAP2D_VIEW_STORAGE_KEY) === "2d";
  } catch {
    return false;
  }
}
export function persistMap2dPreference(view: "2d" | "3d"): void {
  try {
    localStorage.setItem(MAP2D_VIEW_STORAGE_KEY, view);
  } catch {
    /* Storage-disabled devices keep the preference for this session. */
  }
}
export class Map2dRenderer {
  readonly staticLayer = new Map2dStaticLayer();
  private readonly portraits = new AvatarPortraits();
  private readonly petSprites = new PetSpriteAtlases();
  private state: Map2dFrame | null = null;
  private readonly playerFrames = new Map2dPlayerFrames();
  private readonly changes = new Map2dFrameChanges();
  private previousEditing = false;
  private doorAnimationFrame = 0;
  private lastSpriteAnimationDrawMs = Number.NEGATIVE_INFINITY;
  private staticLayoutSource: RoomLayout | null | undefined;
  private staticVehicleIds = "";
  private staticLayout: RoomLayout | null = null;
  private readonly projection: Map2dProjection = { center: { x: 0, z: 0 }, pxPerM: 0, widthPx: 0, heightPx: 0, dpr: 1 };
  private pointer: {
    id: number;
    button: number;
    start: ScreenPoint;
    previous: ScreenPoint;
    dragged: boolean;
  } | null = null;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly listener: Map2dListener,
  ) {
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "2D office map; M toggles view");
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", this.pointerCancel);
    canvas.addEventListener("lostpointercapture", this.pointerCancel);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    canvas.addEventListener("contextmenu", this.contextMenu);
  }
  private point(event: PointerEvent | WheelEvent): ScreenPoint {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private readonly pointerDown = (event: PointerEvent): void => {
    if ((event.button !== 0 && event.button !== 2) || this.pointer || !this.state?.visible) return;
    if (event.button === 2) event.preventDefault();
    this.canvas.focus();
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.point(event);
    this.pointer = {
      id: event.pointerId,
      button: event.button,
      start: point,
      previous: point,
      dragged: false,
    };
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    const pointer = this.pointer;
    const state = this.state;
    if (!pointer || pointer.id !== event.pointerId || !state?.visible) return;
    const point = this.point(event);
    pointer.dragged ||= isMap2dDrag(pointer.start, point);
    if (pointer.dragged)
      this.listener.pan({
        x:
          this.projection.center.x -
          (point.x - pointer.previous.x) / this.projection.pxPerM,
        z:
          this.projection.center.z -
          (point.y - pointer.previous.y) / this.projection.pxPerM,
      });
    pointer.previous = point;
  };
  private readonly pointerUp = (event: PointerEvent): void => {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    this.pointer = null;
    if (pointer.button !== 0) return;
    const state = this.state;
    const point = this.point(event);
    if (pointer.dragged || isMap2dDrag(pointer.start, point) || !state?.visible) return;
    const renderedPlayers = map2dRestingPlayers(this.playerFrames.players, state.layout?.props ?? []);
    const playerId = pickMap2dPlayer(
      this.projection,
      renderedPlayers,
      point,
    );
    if (playerId) {
      this.listener.selectPlayer(playerId, event.clientX, event.clientY);
      return;
    }
    const world = screenToWorld(this.projection, point);
    if (
      Math.abs(world.x) <= state.widthM / 2 &&
      Math.abs(world.z) <= state.depthM / 2
    )
      this.listener.walk(world);
  };
  private readonly contextMenu = (event: MouseEvent): void => { event.preventDefault(); };
  private readonly pointerCancel = (event: PointerEvent): void => {
    if (this.pointer?.id === event.pointerId) this.pointer = null;
  };
  private readonly wheel = (event: WheelEvent): void => {
    const state = this.state;
    if (!state?.visible) return;
    event.preventDefault();
    if (state.view === "3d") {
      this.listener.zoomOverview(event.deltaY);
      return;
    }
    const point = this.point(event);
    const before = screenToWorld(this.projection, point);
    const scale = map2dWheelScale(this.projection.pxPerM, event.deltaY);
    this.listener.zoom(scale);
    const after = screenToWorld({ ...this.projection, pxPerM: scale }, point);
    this.listener.pan({
      x: this.projection.center.x + before.x - after.x,
      z: this.projection.center.z + before.z - after.z,
    });
  };
  private resizeCanvas(): void {
    const p = this.projection;
    const width = Math.round(p.widthPx * p.dpr);
    const height = Math.round(p.heightPx * p.dpr);
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.changes.invalidate();
  }
  frame(state: Map2dFrame): Map2dPoint | undefined {
    const idleAnimationsChanged = state.idleAnimationsEnabled !== this.state?.idleAnimationsEnabled;
    this.state = state;
    this.canvas.style.display = state.visible ? "block" : "none";
    if (!state.visible) {
      if (this.doorAnimationFrame) cancelAnimationFrame(this.doorAnimationFrame);
      this.doorAnimationFrame = 0;
      this.pointer = null;
      this.changes.invalidate();
      return;
    }
    if (this.previousEditing !== Boolean(state.editing)) this.changes.invalidate();
    this.previousEditing = Boolean(state.editing);
    const playersChanged = this.playerFrames.update(state.players, state.localId, state.deltaS, !state.reduceMotion);
    writeMap2dFollowProjection(this.projection, state.projection, Boolean(state.following),
      state.localId ? this.playerFrames.players.get(state.localId) : undefined);
    const p = this.projection;
    this.resizeCanvas();
    const sceneChanged = this.changes.update(
      state,
      p,
      map2dPropModelImages.revision + propPreviewImages.revision,
      this.portraits.revision + this.petSprites.revision,
    );
    let animatingSprite = false;
    for (const player of this.playerFrames.players.values()) {
      if (player.visual.danceElapsedS !== undefined || (player.petId && player.visual.motion === "walking") ||
          (state.idleAnimationsEnabled && !player.vehicleId && player.visual.motion === "idle" && this.portraits.idleCycleMs(player.characterId))) {
        animatingSprite = true;
        break;
      }
    }
    const spriteAnimationDue = petSpriteAnimationRedrawDue(animatingSprite, state.nowMs, this.lastSpriteAnimationDrawMs);
    if (playersChanged || sceneChanged || spriteAnimationDue || idleAnimationsChanged) {
      this.drawFrame(state);
      if (animatingSprite) this.lastSpriteAnimationDrawMs = state.nowMs;
    }
    return p.center;
  }
  private readonly propIndexes = new WeakMap<readonly RoomLayoutProp[], Map<string, RoomLayoutProp>>();

  private drawFrame(state: Map2dFrame): void {
    const p = this.projection;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
    ctx.fillStyle = MAP2D_COLORS.outside;
    ctx.fillRect(0, 0, p.widthPx, p.heightPx);
    const movingVehicleProps: RoomLayoutProp[] = [];
    const movingVehicleIds = new Set<string>();
    if (state.layout) {
      for (const player of this.playerFrames.players.values()) {
        if (!player.vehiclePropId || movingVehicleIds.has(player.vehiclePropId)) continue;
        const props = state.layout.props;
        let index = this.propIndexes.get(props);
        if (!index) {
          index = new Map(props.map(prop => [prop.id, prop]));
          this.propIndexes.set(props, index);
        }
        const prop = index.get(player.vehiclePropId);
        if (!prop) continue;
        movingVehicleIds.add(player.vehiclePropId);
        const driving = Boolean(player.vehicleId);
        const movedProp = {
          ...prop,
          x: driving ? player.x : player.vehiclePropX ?? prop.x,
          z: driving ? player.z : player.vehiclePropZ ?? prop.z,
          rotation: driving ? player.rotation : player.vehiclePropRotation ?? prop.rotation,
        };
        movingVehicleProps.push(movedProp);
      }
    }
    for (const [sessionId, player] of this.playerFrames.players) {
      if (!player.vehicleId || player.vehiclePropId) continue;
      const definition = ROOM_PROP_CATALOG.find(item => item.vehicleId === player.vehicleId);
      if (!definition) continue;
      movingVehicleProps.push({
        id: `auto-vehicle:${sessionId}`,
        asset: definition.asset,
        x: player.x,
        z: player.z,
        rotation: player.rotation,
        width: definition.width,
        depth: definition.depth,
        collision: false,
      });
    }
    const vehicleIds = [...movingVehicleIds].sort().join("|");
    if (this.staticLayoutSource !== state.layout || this.staticVehicleIds !== vehicleIds) {
      this.staticLayoutSource = state.layout;
      this.staticVehicleIds = vehicleIds;
      this.staticLayout = state.layout && movingVehicleIds.size
        ? { ...state.layout, props: state.layout.props.filter(prop => !movingVehicleIds.has(prop.id)) }
        : state.layout;
    }
    const staticProps = this.staticLayout?.props ?? [];
    const visibleProps = movingVehicleProps.length ? [...staticProps, ...movingVehicleProps] : staticProps;
    this.staticLayer.update(
      this.staticLayout,
      state.widthM,
      state.depthM,
      state.configVersion,
      p.pxPerM,
      state.presentation,
    );
    this.staticLayer.blit(ctx, p);
    if (state.proximityDomes?.length) drawMap2dProximityDomes(ctx, p, state.proximityDomes);
    if (state.destination) drawMap2dDestination(ctx, p, state.destination);
    let doorAnimationActive = false;
    drawMap2dDynamic(
      ctx,
      p,
      this.playerFrames.players,
      state.localId,
      state.speaking,
      this.changes.activeDecorations,
      state.nowMs,
      this.portraits,
      state.presentation,
      movingVehicleProps,
      undefined,
      state.layout?.props,
      actors => { doorAnimationActive = drawMap2dSceneOverlay(ctx, p, visibleProps, this.staticLayout, actors,
        state.nowMs, state.editing ? p.center : undefined, {
          editing: Boolean(state.editing),
          editProps: Boolean(state.editProps),
          currentPrivateZoneId: state.currentPrivateZoneId,
        }); },
      () => drawMap2dInteraction(
        ctx,
        p,
        visibleProps,
        state.localId ? this.playerFrames.players.get(state.localId) : undefined,
      ),
      this.petSprites,
      state.idleAnimationsEnabled,
    );
    if (doorAnimationActive && !this.doorAnimationFrame) {
      this.doorAnimationFrame = requestAnimationFrame(() => {
        this.doorAnimationFrame = 0;
        const latestState = this.state;
        if (latestState?.visible) this.drawFrame({ ...latestState, nowMs: performance.now(), deltaS: 0 });
      });
    }
    drawMap2dRoomLabels(ctx, p, state.layout?.zones ?? []);
  }
  dispose(): void {
    if (this.doorAnimationFrame) cancelAnimationFrame(this.doorAnimationFrame);
    this.doorAnimationFrame = 0;
    this.staticLayer.dispose();
    this.portraits.dispose();
    this.petSprites.dispose();
    this.playerFrames.clear();
    this.lastSpriteAnimationDrawMs = Number.NEGATIVE_INFINITY;
    this.staticLayoutSource = undefined;
    this.staticLayout = null;
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.pointerCancel);
    this.canvas.removeEventListener("lostpointercapture", this.pointerCancel);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.canvas.removeEventListener("contextmenu", this.contextMenu);
  }
}
