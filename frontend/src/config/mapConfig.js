import axios from "axios";

// Vite's dev server proxies /api to localhost:3001, but production (Azure Static Web Apps) has no
// such proxy, so both environments must point at the backend explicitly.
const API_BASE_URL = window.location.hostname.includes("localhost")
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : "https://rrr-backend-dehee0etbwefffbv.southeastasia-01.azurewebsites.net";

// API key is fetched from the backend at runtime so it never ships in the bundle.
let apiKeyPromise = null;

export const fetchMapApiKey = async () => {
  if (!apiKeyPromise) {
    apiKeyPromise = (async () => {
      const { data } = await axios.post(`${API_BASE_URL}/api/map/config`);

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch map config");
      }

      return data.apiKey;
    })();
  }

  return apiKeyPromise;
};

export const SURVEY_TYPES = ["Regular", "Rope Bridge", "External"];

// Nudges observations that share the exact same coordinates apart in a small spiral so
// overlapping pins are visually distinguishable once zoomed in, instead of stacking perfectly.
const spreadOverlappingLocations = (locations) => {
  const seenCount = new Map();
  const JITTER_STEP = 0.00004; // roughly 4 meters, negligible at map scale

  return locations.map((location) => {
    const key = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
    const occurrence = seenCount.get(key) ?? 0;
    seenCount.set(key, occurrence + 1);
    if (occurrence === 0) return location;

    const angle = (occurrence * 137.508 * Math.PI) / 180; // golden-angle spiral avoids re-overlapping
    const radius = JITTER_STEP * occurrence;
    return {
      ...location,
      lat: location.lat + radius * Math.cos(angle),
      lng: location.lng + radius * Math.sin(angle),
    };
  });
};

// Survey observation coordinates (columns K & L of the survey sheet).
export const fetchSurveyLocations = async (surveyType = "Regular") => {
  const { data } = await axios.post(`${API_BASE_URL}/api/survey-locations`, { surveyType });

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch survey locations");
  }

  const locations = data.locations.map((location) => ({
    ...location,
    hasImage: location.imageUrl ? "Yes" : "No",
  }));

  return spreadOverlappingLocations(locations);
};

// The sheet's own pre-computed summary stats (Total Surveys, Unique Species, etc.) for the given survey type.
export const fetchSurveySummary = async (surveyType = "Regular") => {
  const { data } = await axios.post(`${API_BASE_URL}/api/survey-summary`, { surveyType });

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch survey summary");
  }

  return data.summary;
};

const percent = (part, total) => (total > 0 ? `${((part / total) * 100).toFixed(2)}%` : "0.00%");

// Computes the Overview/Data Overview stat cards straight from whatever location set is passed in, so
// they always reflect the same active filters/search as the rest of the app (map, charts, table) instead
// of a separate unfiltered total fetched from the backend.
export const buildSurveySummaryItems = (locations) => {
  const species = new Set();
  const targetSpecies = new Set();
  const volunteers = new Set();
  let totalIndividuals = 0;
  let targetIndividuals = 0;
  const cardinal = { north: 0, south: 0 };
  const relative = { left: 0, right: 0, onRoad: 0 };

  for (const location of locations) {
    const scientificName = location.scientificName?.trim().toLowerCase();
    const count = Number(location.count) || 0;
    const isTarget = location.targetSpecies?.trim().toLowerCase() === "yes";

    if (scientificName) species.add(scientificName);
    totalIndividuals += count;
    if (isTarget) {
      targetIndividuals += count;
      if (scientificName) targetSpecies.add(scientificName);
    }

    (location.surveyors || "")
      .split(/[,&]/)
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
      .forEach((name) => volunteers.add(name));

    const cardinalAnswer = location.side?.trim().toLowerCase();
    if (cardinalAnswer === "north") cardinal.north++;
    else if (cardinalAnswer === "south") cardinal.south++;

    const relativeAnswer = location.sideLR?.trim().toLowerCase() || "";
    if (relativeAnswer.startsWith("l")) relative.left++;
    else if (relativeAnswer.startsWith("r")) relative.right++;
    else if (relativeAnswer.includes("on")) relative.onRoad++;
  }

  const items = [
    // Every row is its own recorded sighting/survey entry, not deduplicated by Survey ID session.
    { label: "Total Number of Surveys", value: String(locations.length) },
    { label: "Unique Species", value: String(species.size) },
    { label: "Target Species Recorded", value: String(targetSpecies.size) },
    { label: "Target Individuals Recorded", value: String(targetIndividuals) },
    { label: "Total Individuals Recorded", value: String(totalIndividuals) },
    { label: "Total Number of Volunteers", value: String(volunteers.size) },
  ];


  // Only show a side-of-the-road group when its underlying question actually has real answers in the
  // current (filtered) location set - e.g. External never asks a cardinal N/S question.
  const cardinalTotal = cardinal.north + cardinal.south;
  if (cardinalTotal > 0) {
    items.push(
      { label: "Side of the Road (cardinal directions) - North", value: percent(cardinal.north, cardinalTotal) },
      { label: "Side of the Road (cardinal directions) - South", value: percent(cardinal.south, cardinalTotal) }
    );
  }

  const relativeTotal = relative.left + relative.right + relative.onRoad;
  if (relativeTotal > 0) {
    items.push(
      { label: "Side of the Road (relative to surveyor) - Left", value: percent(relative.left, relativeTotal) },
      { label: "Side of the Road (relative to surveyor) - Right", value: percent(relative.right, relativeTotal) },
      {
        label: "Side of the Road (relative to surveyor) - On the Road",
        value: percent(relative.onRoad, relativeTotal),
      }
    );
  }

  return { items };
};

// The sheet's "Species List" tab, used as the conservation-status reference for each observation.
export const fetchSpeciesList = async () => {
  const { data } = await axios.post(`${API_BASE_URL}/api/species-list`);

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch species list");
  }

  return data.species;
};

// Sightings sometimes prefix a Table B scientific name with its taxonomic rank (e.g. "Family Muridae"
// instead of just "Muridae") - strip that so it still matches Table B's own scientificName column.
const normalizeScientificName = (value) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^(kingdom|phylum|class|order|family|genus|species|subfamily|suborder)\s+/, "");

// Looks up species status by scientific name (case-insensitive, trimmed, rank-prefix stripped) for quick
// per-observation access. Also indexed by common name (scientific name wins on collision) so Table B's
// higher-taxonomic-level rows - recorded as a placeholder common name like "Unknown Bat" rather than a
// real scientific name, e.g. "Chiroptera" - are still reachable from a sighting that only has that common name.
export const buildSpeciesStatusLookup = (species) => {
  const lookup = new Map();
  for (const entry of species) {
    const commonKey = entry.commonName?.trim().toLowerCase();
    if (commonKey) lookup.set(commonKey, entry);
  }
  for (const entry of species) {
    const sciKey = normalizeScientificName(entry.scientificName);
    if (sciKey) lookup.set(sciKey, entry);
  }
  return lookup;
};

// Looks up a location's species entry, trying its scientific name first (Table A/B) then falling back
// to its common name (Table B's "Unknown X" placeholders, which sightings only ever record by that name).
export const lookupSpeciesStatus = (speciesStatusLookup, location) => {
  const sciKey = normalizeScientificName(location.scientificName);
  if (sciKey && speciesStatusLookup.has(sciKey)) return speciesStatusLookup.get(sciKey);
  const commonKey = location.commonName?.trim().toLowerCase();
  if (commonKey && speciesStatusLookup.has(commonKey)) return speciesStatusLookup.get(commonKey);
  return undefined;
};

// Marker/legend color per "which side of the road" value, matching the sheet's own categories.
export const SIDE_COLORS = {
  North: "#4285f4",
  South: "#34a853",
  Unknown: "#9aa0a6",
};

// Columns worth offering as interactive button-group filters (beyond side, which the Legend already covers).
// Grouped into two cards so the Filters panel isn't one giant list.
// Fields with only one distinct value in the currently-loaded dataset are auto-hidden by the Filters
// panel, so Rope-Bridge-only fields (e.g. crossingType) simply don't appear while viewing Regular data,
// and vice versa - no need to branch this list by survey type.
export const FILTERABLE_FIELDS = [
  { field: "taxa", label: "Taxanomy", group: "Species" },
  { field: "targetSpecies", label: "Target Species", group: "Species" },
  { field: "identified", label: "Identified", group: "Species" },
  { field: "isRoadkill", label: "Roadkill", group: "Species" },
  { field: "hasImage", label: "Has Image?", group: "Species" },
  { field: "crossingType", label: "Crossing Type", group: "Species" },
  { field: "onRopeBridge", label: "On Rope Bridge?", group: "Species" },
  { field: "surveyDirection", label: "Survey Direction", group: "Survey" },
  { field: "sideLR", label: "Side (L/R/On road)", group: "Survey" },
  { field: "weatherConditions", label: "Weather Conditions", group: "Survey" },
];

// The Road Bridge page has no notion of a road "side"/direction of travel (that's a road-survey-only
// concept, covered on the Map page by the Legend), so those two fields are left out here - every other
// field is a real column on the Rope Bridge table, matching what the Observations table shows for it.
export const ROPE_BRIDGE_FILTERABLE_FIELDS = FILTERABLE_FIELDS.filter(
  ({ field }) => field !== "surveyDirection" && field !== "sideLR"
);

// Every sheet column, ordered by importance (identity -> description -> when/where -> logistics -> raw/meta)
// for the full observations table (outside the map/details panel).
export const TABLE_COLUMNS = [
  { field: "commonName", label: "Common Name" },
  { field: "scientificName", label: "Scientific Name" },
  { field: "count", label: "Count" },
  { field: "taxa", label: "Taxanomy" },
  { field: "crossingType", label: "Crossing Type" },
  { field: "targetSpecies", label: "Target Species" },
  { field: "identified", label: "Identified?" },
  { field: "isRoadkill", label: "Roadkill?" },
  { field: "onRopeBridge", label: "On Rope Bridge?" },
  { field: "remarks", label: "Behaviours / Remarks" },
  { field: "surveyDate", label: "Survey Date" },
  { field: "timeOfObservation", label: "Time of Observation" },
  { field: "side", label: "Side (N/S)" },
  { field: "sideLR", label: "Side (L/R/On road)" },
  { field: "surveyDirection", label: "Survey Direction" },
  { field: "coordsNearestLandmarks", label: "Coords / Nearest Landmarks" },
  { field: "ropeBridgeId", label: "Rope Bridge ID" },
  { field: "surveyors", label: "Surveyors" },
  { field: "weatherConditions", label: "Weather Conditions" },
  { field: "surveyId", label: "Survey ID" },
  { field: "surveyStartTime", label: "Survey Start Time" },
  { field: "surveyEndTime", label: "Survey End Time" },
  { field: "lat", label: "Lat" },
  { field: "lng", label: "Lon" },
  { field: "inatUsername", label: "iNat Username" },
  { field: "imageUrl", label: "Image URL" },
];


// Survey dates aren't in one consistent format across sheets - Regular/Rope Bridge use `YYYY-MM-DD`,
// External uses `DD/MM/YYYY` - so both need to be recognized wherever a location's surveyDate is parsed
// (charting, table sorting), rather than assuming one shape.
export const parseSurveyDate = (dateStr) => {
  const trimmed = dateStr?.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] };

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return { year: slashMatch[3], month: slashMatch[2], day: slashMatch[1] };

  return null;
};

// A sortable numeric key (YYYYMMDD) for a surveyDate string, regardless of which of the above formats it's
// in - unparseable/blank dates sort first (0) rather than throwing off the rest of the ordering.
export const surveyDateSortValue = (dateStr) => {
  const parsed = parseSurveyDate(dateStr);
  if (!parsed) return 0;
  return Number(`${parsed.year}${parsed.month.padStart(2, "0")}${parsed.day.padStart(2, "0")}`);
};

export const MAP_TYPE_LABEL = "Hybrid";

export const SINGAPORE_CENTER = { lat: 1.338700, lng: 103.784500 };
export const DEFAULT_ZOOM = 15;

// Rifle Range Nature Park <-> ST Engineering Rifle Range Park stretch, with a small buffer.
export const SURVEY_SEGMENT_BOUNDS = {
  south: 1.340000,
  north: 1.359000,
  west: 103.776000,
  east: 103.800000,
};
