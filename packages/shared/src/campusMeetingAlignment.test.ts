import assert from "node:assert/strict";
import test from "node:test";
import { generateCampusMap } from "./campusMapGenerator.js";
import { roomZoneEntranceIssues } from "./index.js";

// Only the compact ten-team campus aligns; other shapes keep evenly spaced rows when alignment would leave the map.
for (const [totalPeople, peoplePerTeam, teamCount] of [[150, 15, 10], [40, 4, 10]] as const) {
  test(`meeting rooms sit above/below their team (${teamCount} teams)`, () => {
    const { zones } = generateCampusMap({ totalPeople, peoplePerTeam, teamCount }).layout;
    const topTeams = Math.ceil(teamCount / 2);
    for (let team = 1; team <= teamCount; team += 1) {
      const offices = zones.filter((zone) => zone.id.startsWith(`team-${team}-office-`));
      const centre = (Math.min(...offices.map((z) => z.x - z.width / 2)) + Math.max(...offices.map((z) => z.x + z.width / 2))) / 2;
      const index = team <= topTeams ? team : team - topTeams;
      const meeting = zones.find((zone) => zone.id === `meeting-${team <= topTeams ? "north" : "south"}-${index}`);
      assert.ok(meeting, `team ${team} has a meeting room`);
      assert.ok(Math.abs(meeting.x - centre) <= 4, `team ${team}: meeting x ${meeting.x} vs team centre ${centre}`);
    }
  });
}

test("every generated room entrance is clear, so the compact campus can be saved", () => {
  const { layout } = generateCampusMap({ totalPeople: 150, peoplePerTeam: 15, teamCount: 10, seed: 3 });
  assert.deepEqual(roomZoneEntranceIssues(layout), []);
});
