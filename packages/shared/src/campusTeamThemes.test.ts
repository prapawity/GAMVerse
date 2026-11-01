import assert from "node:assert/strict";
import test from "node:test";
import { createCampusOfficeDraft } from "./campusFurnishing.js";
import { generateCampusMap } from "./campusMapGenerator.js";
import { campusPrivateRoomPlacements } from "./campusPrivateRoomTemplate.js";
import { TEAM_THEMES, TEAM_THEME_COUNT, teamThemeFor, themedAsset } from "./campusTeamThemes.js";
import { ROOM_PROP_CATALOG } from "./roomLayout.js";

const COZY_INDEX = 0;
const KIT_BED = "kit:bedsingle";

test("ten distinct team themes cycle for larger campuses", () => {
  assert.equal(TEAM_THEME_COUNT, 10);
  assert.equal(new Set(TEAM_THEMES.map((theme) => theme.id)).size, 10);
  assert.equal(teamThemeFor(11).id, teamThemeFor(1).id);
});

test("a theme supplies its own asset first and falls back to the default when it has none", () => {
  const cozyBed = themedAsset(COZY_INDEX, "bed", KIT_BED, "room");
  assert.notEqual(cozyBed, KIT_BED);
  assert.match(ROOM_PROP_CATALOG.find((item) => item.asset === cozyBed)!.group ?? "", /Cozy Home/);
  const pirateIndex = TEAM_THEMES.findIndex((theme) => theme.id === "pirate");
  assert.equal(themedAsset(pirateIndex, "bed", KIT_BED, "room"), KIT_BED, "Pirate Cove has no bed, so the default stays");
});

test("themed studios keep every placement key and a valid catalog asset", () => {
  const { layout } = generateCampusMap({ totalPeople: 150, peoplePerTeam: 15, teamCount: 10 });
  for (const zone of layout.zones.filter((item) => item.kind === "private")) {
    for (const placement of campusPrivateRoomPlacements(zone)) assert.ok(ROOM_PROP_CATALOG.some((item) => item.asset === placement.asset), `${zone.id} ${placement.key}`);
  }
});

test("each team's studios use a different look than its neighbours", () => {
  const { layout } = generateCampusMap({ totalPeople: 150, peoplePerTeam: 15, teamCount: 10 });
  const assetsOf = (team: number) => new Set(layout.zones.filter((zone) => zone.id.startsWith(`team-${team}-office-`)).flatMap((zone) => campusPrivateRoomPlacements(zone).map((placement) => placement.asset)));
  const first = assetsOf(1);
  const second = assetsOf(2);
  assert.ok([...first].some((asset) => !second.has(asset)) && [...second].some((asset) => !first.has(asset)));
});

test("the furnished compact campus stays under the office prop limit with vehicles, poles and forest", () => {
  const draft = createCampusOfficeDraft({ totalPeople: 150, peoplePerTeam: 15, teamCount: 10 }, "furnished");
  assert.ok(draft.layout.props.length < 10_000);
  const { layout } = generateCampusMap({ totalPeople: 150, peoplePerTeam: 15, teamCount: 10 });
  assert.equal(layout.props.filter((prop) => prop.id.startsWith("campus-vehicle-")).length, 20);
  assert.ok(layout.props.some((prop) => prop.id.startsWith("campus-utility-pole-")));
  assert.ok(layout.props.filter((prop) => prop.id.includes("civic-park-")).length > 50);
});
