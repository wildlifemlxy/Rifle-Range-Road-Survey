# Animal species images

Drop one image per species in this folder to have it show up automatically on the Road Bridge
visualization - no code changes needed, the lookup below picks up every file here at build time.

- **File name = species name.** Spaces/punctuation don't matter, they're normalized away, e.g.
  `Plantain Squirrel.png`, `plantain-squirrel.png` and `plantain_squirrel.PNG` all match a sighting
  whose Common Name is "Plantain Squirrel". The Scientific Name column is also checked as a fallback.
- **Formats:** `.png`, `.webp`, `.jpg`/`.jpeg` (any case).
- **Background:** must be transparent (no white/colored background, no border/frame) - crop the
  animal out of its photo first, since the app doesn't add anything behind or around the image.
- **Fallback:** add a `default.png` here to show for any sighting whose species doesn't have a
  matching image yet.

See `../../utils/speciesImages.js` for the matching logic.
