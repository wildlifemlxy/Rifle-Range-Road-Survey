import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Two levels up from either src/api (dev) or dist/api (if ever built) lands on the backend package root,
// where this large (40MB, island-wide) dataset lives outside src/ so it's never treated as source.
const LAMPPOST_GEOJSON_PATH = path.resolve(__dirname, "../../data/LTALampPost.geojson");

let lampPostIndexCache = null;

// The LTA dataset covers all of Singapore (100k+ points) and lamp post numbers reset per road, so this
// is filtered down to the same lat/lng box the survey itself is bound to before ever being kept in memory -
// parsed and filtered once (lazily, on first use), not on every request.
const loadLampPostIndex = () => {
  if (lampPostIndexCache) return lampPostIndexCache;

  const raw = fs.readFileSync(LAMPPOST_GEOJSON_PATH, "utf-8");
  const geojson = JSON.parse(raw);

  lampPostIndexCache = geojson.features
    .map((feature) => ({
      num: (feature.properties.LAMPPOST_NUM || "").trim(),
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
    }))
    .filter(
      (point) => point.num && point.lat >= 1.34 && point.lat <= 1.359 && point.lng >= 103.776 && point.lng <= 103.8
    );

  return lampPostIndexCache;
};

const squaredDistance = (a, b) => (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

// A sighting logged as "Lamp post 92" (rather than real GPS) can be resolved to that lamp post's actual
// surveyed coordinates - but the same plain number recurs on different paths/roads within the survey's
// bounding box, so ties are broken by picking whichever candidate sits closest to an already-known real
// coordinate from this same survey (its logged GPS track effectively traces the road/path), rather than
// picking arbitrarily.
export const resolveLampPostCoords = (lampPostNum, roadReferencePoints) => {
  const candidates = loadLampPostIndex().filter((point) => point.num === lampPostNum);
  if (candidates.length === 0) return null;
  if (candidates.length === 1 || roadReferencePoints.length === 0) return candidates[0];

  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    for (const reference of roadReferencePoints) {
      const distance = squaredDistance(candidate, reference);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  }
  return best;
};

// Matches "Lamp post 92", "lamppost 92", "Lamp Post 47" etc. in a free-text coords/landmarks field -
// a few rows just note the bare number with no label at all (e.g. "3"), which is only ever safe to
// treat as a lamp post number when it clearly isn't a coordinate pair (those always have a comma).
export const extractLampPostNumber = (text) => {
  const trimmed = (text || "").trim();
  const labelled = trimmed.match(/lamp\s*post\s*([\w\-/]+)/i);
  if (labelled) return labelled[1].trim();
  return /^[\w-]+$/.test(trimmed) ? trimmed : null;
};
