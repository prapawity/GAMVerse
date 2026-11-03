import type { Map2dPresentation } from "./map2dPresentation";
import { isRoomPropBed, parseRoomPropSeatReference, nearestInteractiveProp, type RoomLayoutProp } from "@gammyverse/shared";
import { MAP2D_AVATAR_RADIUS_PX, MAP2D_COLORS, MAP2D_FONT_PX, MAP2D_NAME_OFFSET_PX } from "./constants";
import { worldToScreen, type Map2dPoint, type Map2dProjection } from "./map2dProjection";
import type { AvatarPose } from "./avatarPoseSmoother";
import type { AvatarPortraits } from "./avatarPortraits";
import { playerName } from "../../identity/playerName";
import { map2dNameFontPx, map2dNamePillTopPx, NAME_PILL_HEIGHT_PADDING_PX } from "./avatarPortraitGeometry";
import { drawMap2dAvatar, drawMap2dAvatarIndicators } from "./map2dAvatarDrawing";
import type { Map2dPlayer } from "./map2dAvatarVisual";
import { AVATAR_SPRITE_TARGET_HEIGHT_M } from "./avatarSpriteGeometry";
import { fitMap2dName, layoutMap2dNames, type Map2dNameCandidate, type Map2dNameRect } from "./map2dNameLayout";
import { map2dRestingPlayers } from "./map2dRestingPlayers";
import { map2dPetActor } from "./map2dPetDrawing";
import type { PetSpriteAtlases } from "./petSpriteAtlases";
export type { Map2dPlayer } from "./map2dAvatarVisual";
export type Map2dDecoration = { sessionId: string; text: string; expiresAtMs: number };
const FULL_CIRCLE_RAD = Math.PI * 2;
const AVATAR_RING_GAP_PX = 4;
const DECORATION_GAP_PX = 20;
const DECORATION_RISE_PX = 12;
const DECORATION_ANIMATION_PERIOD_MS = 600;
const NAME_PILL_PADDING_PX = 5;
const NAME_PILL_RADIUS_PX = 7;
const NAME_BASELINE_PADDING_PX = 4;
const NAME_MAX_TEXT_WIDTH_PX = 150;
const NAME_PILL_COLOR = "rgba(38, 48, 53, 0.92)";
const AVATAR_OBSTACLE_PADDING_PX = 12;
const NAME_AVATAR_CLEARANCE_PX = 4;
const VEHICLE_OCCUPANT_SCALE = 0.42;
const MAP2D_ACTOR_RENDER_DISTANCE_M = 60;

export type Map2dSceneActor = {
  x: number;
  z: number;
  elevation?: number;
  local: boolean;
  draw(ctx: CanvasRenderingContext2D, projection: Map2dProjection): void;
};

function drawAvatarBody(ctx: CanvasRenderingContext2D, p: Map2dProjection, id: string, player: Map2dPlayer,
  localId: string | null, speaking: ReadonlySet<string>, portraits: AvatarPortraits | undefined,
  presentation: Map2dPresentation, layoutProps: readonly RoomLayoutProp[]): void {
  const local = id === localId;
  const isSpeaking = speaking.has(player.username.toLocaleLowerCase());
  if (player.vehicleId) {
    const screen = worldToScreen(p, player, player.renderElevationM);
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.scale(VEHICLE_OCCUPANT_SCALE, VEHICLE_OCCUPANT_SCALE);
    ctx.translate(-screen.x, -screen.y);
    drawMap2dAvatar(ctx, p, { ...player, sittingPropId: undefined,
      visual: { motion: "seated", stridePhaseRad: 0 } }, false, false, portraits, false);
    ctx.restore();
    return;
  }
  const restingPropId = player.sittingPropId ? parseRoomPropSeatReference(player.sittingPropId)?.propId : undefined;
  drawMap2dAvatar(ctx, p, player, local, isSpeaking, portraits, presentation === "immersive",
    Boolean(restingPropId && layoutProps.some(prop => prop.id === restingPropId && isRoomPropBed(prop.asset))));
}

function drawNames(ctx: CanvasRenderingContext2D, p: Map2dProjection,
  players: ReadonlyMap<string, Map2dPlayer>, localId: string | null, speaking: ReadonlySet<string>, hiddenNameIds: ReadonlySet<string>): void {
  const fontPx = map2dNameFontPx(p.pxPerM);
  const candidates: Map2dNameCandidate[] = [];
  const obstacles: Map2dNameRect[] = [];
  ctx.save();
  ctx.font = `${fontPx}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const [sessionId, player] of players) {
    const screen = worldToScreen(p, player, player.renderElevationM);
    const bodyWidthPx = Math.max(12, 0.8 * p.pxPerM);
    const bodyTopPx = screen.y - AVATAR_SPRITE_TARGET_HEIGHT_M * p.pxPerM;
    obstacles.push({ leftPx: screen.x - bodyWidthPx / 2 - NAME_AVATAR_CLEARANCE_PX, topPx: bodyTopPx - NAME_AVATAR_CLEARANCE_PX,
      widthPx: bodyWidthPx + NAME_AVATAR_CLEARANCE_PX * 2, heightPx: screen.y - bodyTopPx + AVATAR_OBSTACLE_PADDING_PX });
    if (hiddenNameIds.has(sessionId)) continue;
    const maxTextWidthPx = Math.max(0, Math.min(NAME_MAX_TEXT_WIDTH_PX, p.widthPx - NAME_PILL_PADDING_PX * 2));
    const text = fitMap2dName(playerName(player), maxTextWidthPx, name => ctx.measureText(name).width);
    candidates.push({ sessionId, text, xPx: screen.x,
      topPx: map2dNamePillTopPx(screen.y, AVATAR_SPRITE_TARGET_HEIGHT_M * p.pxPerM, fontPx) - NAME_AVATAR_CLEARANCE_PX,
      widthPx: ctx.measureText(text).width + NAME_PILL_PADDING_PX * 2, heightPx: fontPx + NAME_PILL_HEIGHT_PADDING_PX,
      local: sessionId === localId, speaking: speaking.has(player.username.toLocaleLowerCase()), handRaised: Boolean(player.handRaised) });

  }
  for (const label of layoutMap2dNames(candidates, p, obstacles)) {
    ctx.fillStyle = NAME_PILL_COLOR;
    ctx.beginPath();
    ctx.roundRect(label.leftPx, label.topPx, label.widthPx, label.heightPx, NAME_PILL_RADIUS_PX);
    ctx.fill();
    ctx.fillStyle = MAP2D_COLORS.white;
    ctx.fillText(label.text, label.leftPx + label.widthPx / 2, label.topPx + label.heightPx - NAME_BASELINE_PADDING_PX);
  }
  ctx.restore();
}
export function drawMap2dDynamic(
  ctx: CanvasRenderingContext2D,
  p: Map2dProjection,
  players: ReadonlyMap<string, Map2dPlayer>,
  localId: string | null,
  speaking: ReadonlySet<string>,
  decorations: readonly Map2dDecoration[],
  nowMs: number,
  portraits?: AvatarPortraits,
  presentation: Map2dPresentation = "immersive",
  _movingVehicleProps: readonly RoomLayoutProp[] = [],
  hiddenNameIds: ReadonlySet<string> = new Set(),
  layoutProps: readonly RoomLayoutProp[] = [],
  drawScene?: (actors: readonly Map2dSceneActor[]) => void,
  afterScene?: () => void,
  petSprites?: PetSpriteAtlases,
): void {
  players = map2dRestingPlayers(players, layoutProps);
  const renderDistanceSquared = MAP2D_ACTOR_RENDER_DISTANCE_M * MAP2D_ACTOR_RENDER_DISTANCE_M;
  players = new Map(Array.from(players).filter(([id, player]) => {
    if (id === localId) return true;
    const dx = player.x - p.center.x;
    const dz = player.z - p.center.z;
    return dx * dx + dz * dz <= renderDistanceSquared;
  }));
  portraits?.setActiveCharacters(Array.from(players.values(), player => player.characterId));
  petSprites?.setActivePets(Array.from(players.values(), player => player.petId));
  const actors: Map2dSceneActor[] = Array.from(players, ([id, player]) => ({
    x: player.x,
    z: player.z,
    elevation: player.renderElevationM ?? 0,
    local: id === localId,
    draw: (target: CanvasRenderingContext2D, projection: Map2dProjection) =>
      drawAvatarBody(target, projection, id, player, localId, speaking, portraits, presentation, layoutProps),
  }));
  for (const [id, player] of players) {
    const pet = map2dPetActor(id, player, petSprites, nowMs);
    if (pet) actors.push(pet);
  }
  if (drawScene) drawScene(actors);
  else for (const actor of actors.sort((a, b) => a.z - b.z)) actor.draw(ctx, p);
  afterScene?.();
  for (const [id, player] of players)
    if (!player.vehicleId) drawMap2dAvatarIndicators(ctx, p, player, id === localId, speaking.has(player.username.toLocaleLowerCase()));
  drawNames(ctx, p, players, localId, speaking, hiddenNameIds);
  for (const decoration of decorations) {
    const player = players.get(decoration.sessionId);
    if (!player || decoration.expiresAtMs <= nowMs) continue;
    const screen = worldToScreen(p, player, player.renderElevationM);
    ctx.fillStyle = MAP2D_COLORS.text;
    ctx.font = `${MAP2D_FONT_PX}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(
      decoration.text,
      screen.x,
      map2dNamePillTopPx(screen.y, AVATAR_SPRITE_TARGET_HEIGHT_M * p.pxPerM, map2dNameFontPx(p.pxPerM)) -
        DECORATION_GAP_PX -
        Math.sin(nowMs / DECORATION_ANIMATION_PERIOD_MS) * DECORATION_RISE_PX,
    );
  }
}

export function drawMap2dInteraction(
  ctx: CanvasRenderingContext2D,
  projection: Map2dProjection,
  props: readonly RoomLayoutProp[],
  local: AvatarPose | undefined,
): void {
  if (!local) return;
  const prop = nearestInteractiveProp(props, local);
  if (!prop) return;
  const screen = worldToScreen(projection, prop);
  ctx.strokeStyle = MAP2D_COLORS.local;
  ctx.beginPath();
  ctx.arc(
    screen.x,
    screen.y,
    (Math.max(prop.width, prop.depth) * projection.pxPerM) / 2 +
      AVATAR_RING_GAP_PX,
    0,
    FULL_CIRCLE_RAD,
  );
  ctx.stroke();
  ctx.fillStyle = MAP2D_COLORS.text;
  ctx.fillText("X to open", screen.x, screen.y - MAP2D_NAME_OFFSET_PX);
}

export function drawMap2dDestination(
  ctx: CanvasRenderingContext2D,
  projection: Map2dProjection,
  destination: Map2dPoint,
): void {
  const screen = worldToScreen(projection, destination);
  ctx.strokeStyle = MAP2D_COLORS.local;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, MAP2D_AVATAR_RADIUS_PX, 0, FULL_CIRCLE_RAD);
  ctx.stroke();
  ctx.fillStyle = MAP2D_COLORS.local;
  ctx.fillText("×", screen.x, screen.y);
}
