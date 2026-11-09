# Demo media for the README

`demo.gif` and the screenshots here were captured headless (single account, software WebGL, so some 3D trees render black). Re-record or extend them for voice and multi-user features on the Compose stack (`docker compose up -d`, https://localhost:5173) with two browser sessions so voice and presence are visible. Do not include real names, emails or invite links in a take.

## Shot list (about 30–45 s)

1. Lobby → create office (team names, furnished starter).
2. 3D walk across the campus, then press `N` for the 2D map.
3. Click-to-auto-walk into a meeting room; the roof opens.
4. Second session joins; voice roster and nameplates appear.
5. Edit Props: drop a prop, then show it in the other session.
6. Emoji reaction, hand raise, and `Z` dance.

## Recording

- macOS: `Cmd+Shift+5` → record selected portion (1280×720). Save as `demo.mov`.
- Convert (needs ffmpeg, `brew install ffmpeg`):

```sh
# Video for README links (small, H.264)
ffmpeg -i demo.mov -vf "scale=1280:-2,fps=30" -c:v libx264 -crf 26 -an docs/media/demo.mp4

# Looping GIF (keep under ~10 MB; trim to the best 10–15 s)
ffmpeg -i demo.mov -vf "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" docs/media/demo.gif
```

## Embedding

GitHub renders the GIF inline: `![GAMVerse demo](docs/media/demo.gif)`. For the MP4, drag the file into a GitHub issue or PR comment to get a hosted URL, then paste that URL on its own line in the README, or link to `docs/media/demo.mp4`.
