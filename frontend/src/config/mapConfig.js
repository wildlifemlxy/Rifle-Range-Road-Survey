import axios from "axios";

// API key is fetched from the backend at runtime so it never ships in the bundle.
let apiKeyPromise = null;

export const fetchMapApiKey = async () => {
  if (!apiKeyPromise) {
    apiKeyPromise = (async () => {
      const { data } = await axios.post("/api/map/config");

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
  const { data } = await axios.post("/api/survey-locations", { surveyType });

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
  const { data } = await axios.post("/api/survey-summary", { surveyType });

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch survey summary");
  }

  return data.summary;
};

// The sheet's "Species List" tab, used as the conservation-status reference for each observation.
export const fetchSpeciesList = async () => {
  const { data } = await axios.post("/api/species-list");

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch species list");
  }

  return data.species;
};

// Looks up species status by scientific name (case-insensitive, trimmed) for quick per-observation access.
// Also indexed by common name (scientific name wins on collision) so Table B's higher-taxonomic-level
// rows - recorded as a placeholder common name like "Unknown Bat" rather than a real scientific name,
// e.g. "Chiroptera" - are still reachable from a sighting that only has that common name.
export const buildSpeciesStatusLookup = (species) => {
  const lookup = new Map();
  for (const entry of species) {
    const commonKey = entry.commonName?.trim().toLowerCase();
    if (commonKey) lookup.set(commonKey, entry);
  }
  for (const entry of species) {
    const sciKey = entry.scientificName?.trim().toLowerCase();
    if (sciKey) lookup.set(sciKey, entry);
  }
  return lookup;
};

// Looks up a location's species entry, trying its scientific name first (Table A) then falling back
// to its common name (Table B's "Unknown X" placeholders, which sightings only ever record by that name).
export const lookupSpeciesStatus = (speciesStatusLookup, location) => {
  const sciKey = location.scientificName?.trim().toLowerCase();
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


export const MAP_TYPE_LABEL = "Hybrid";

export const SINGAPORE_CENTER = { lat: 1.3387, lng: 103.7845 };
export const DEFAULT_ZOOM = 17;

// Rifle Range Nature Park <-> ST Engineering Rifle Range Park stretch, with a small buffer.
export const SURVEY_SEGMENT_BOUNDS = {
  south: 1.34,
  north: 1.359,
  west: 103.776,
  east: 103.8,
};
