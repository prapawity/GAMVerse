import { CanvasTexture, Sprite, SpriteMaterial } from "three";
import type { RoomLayout } from "@gammyverse/shared";
import { groupTeamZones } from "../teamZones";
import { zoneRoofHeightM } from "./zoneVisibility";

const LABEL_HEIGHT_M = 1.8;
const LABEL_ROOF_CLEARANCE_M = 20;
const LABEL_TEXTURE_HEIGHT_PX = 112;
const LABEL_MAX_TEXTURE_WIDTH_PX = 560;
const LABEL_PADDING_PX = 30;

function makeTeamZoneLabel(text: string): Sprite | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  const font = "700 58px Inter, Arial, sans-serif";
  context.font = font;
  canvas.width = Math.min(LABEL_MAX_TEXTURE_WIDTH_PX, Math.ceil(context.measureText(text).width) + 2 * LABEL_PADDING_PX);
  canvas.height = LABEL_TEXTURE_HEIGHT_PX;
  context.fillStyle = "rgba(126, 67, 22, 0.9)";
  context.beginPath();
  context.roundRect(2, 3, canvas.width - 4, canvas.height - 6, 18);
  context.fill();
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 4;
  context.strokeStyle = "rgba(126, 67, 22, 0.92)";
  context.fillStyle = "#f8fafc";
  const textWidth = canvas.width - 2 * LABEL_PADDING_PX;
  context.strokeText(text, canvas.width / 2, canvas.height / 2, textWidth);
  context.fillText(text, canvas.width / 2, canvas.height / 2, textWidth);

  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false }));
  sprite.name = `Team zone: ${text}`;
  sprite.scale.set(LABEL_HEIGHT_M * canvas.width / canvas.height, LABEL_HEIGHT_M, 1);
  sprite.visible = false;
  return sprite;
}

export function createTeamZoneLabels(layout: RoomLayout | null | undefined, offsetX: number, offsetZ: number): Sprite[] {
  if (!layout) return [];
  const labels: Sprite[] = [];
  for (const team of groupTeamZones(layout.zones).teams) {
    const label = makeTeamZoneLabel(team.label);
    if (!label) continue;
    const roofHeightM = Math.max(...team.members.map(zone => zoneRoofHeightM(zone, layout.walls)));
    label.position.set(team.x + offsetX, roofHeightM + LABEL_ROOF_CLEARANCE_M, team.z + offsetZ);
    labels.push(label);
  }
  return labels;
}
