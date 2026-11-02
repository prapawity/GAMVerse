# Props editor load test

Simulates many members saving props at once (delta saves through `POST /offices/:id/props/ops`).
Each virtual editor keeps its own stale copy of what it last saw, moves/adds/removes its private
props, and a share of saves target a small pool of shared props so real conflicts happen.

It checks that every private prop ends exactly where its editor last saw it, that shared props
survive, and that the office returns to its starting prop count. See the header of
`props-editors.mjs` for how to run it. **Run it against a test office.**

Server limits: saves are capped per account (default 30 per 10 s, `OFFICE_PROPS_WRITE_LIMIT`).
With one account, expect HTTP 429s once the editors save faster than that; raise the limit on the
test server or pass several cookies separated by `|`.
