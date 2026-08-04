import axios from "axios";
import { parse } from "csv-parse/sync";
import { extractLampPostNumber, resolveLampPostCoords } from "./lampPostLookup.js";

// Fetches the published Google Sheet as CSV and parses it into records.
export const fetchSurveyRecords = async (sheetId) => {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const response = await axios.get(csvUrl);

  return parse(response.data, {
    columns: true,
    skip_empty_lines: true,
  });
};

// Normalizes the sheet's free-text "Which side of the road..." answers to the same buckets as its own summary row.
const normalizeSide = (value) => {
  const trimmed = (value || "").trim().toLowerCase();
  if (trimmed.startsWith("north")) return "North";
  if (trimmed.startsWith("south")) return "South";
  return "Unknown";
};

// The three survey data tabs, with a few summary rows above the real header. Regular and Rope Bridge
// hold Lat/Lon in their own columns K & L; External has no such columns and instead packs coordinates
// (when recorded at all) into its free-text "Co-ordinates/Nearest Landmarks" column.
const SURVEY_LOCATIONS_GIDS = {
  Regular: "1785548472",
  "Rope Bridge": "869729899",
  External: "1959171440",
};

// Spreadsheet formula-error placeholders (e.g. a VLOOKUP that found no match) that sometimes end up
// baked into the exported CSV as literal text - never a real value, so treated the same as blank.
const isFormulaError = (value) => /^#(n\/a|name\?|value!|ref!|div\/0!|null!|num!)$/i.test((value || "").trim());

// Reads the first non-blank value among a list of possible header names, since the sheets
// phrase some of the same logical question slightly differently (or don't ask it at all).
const pick = (record, keys) => {
  for (const key of keys) {
    if (record[key] && !isFormulaError(record[key])) return record[key];
  }
  return "";
};

// External has no separate Lat/Lon columns - when a sighting has real coordinates at all, they're
// packed as free text (e.g. "1.352833, 103.784808") into the coords/landmarks column, alongside rows
// that just note a lamp post number or nothing instead.
const parseCoordsFromText = (value) => {
  const match = (value || "").match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

// Regular is GPS-logged throughout the survey, so its real coordinates effectively trace the road/path -
// used as a reference to disambiguate lamp post numbers that recur on different paths within the same
// bounding box (see lampPostLookup.js). Refreshed each time Regular itself is fetched.
let roadReferencePoints = [];

export const fetchSurveyLocations = async (sheetId, surveyType = "Regular") => {
  const gid = SURVEY_LOCATIONS_GIDS[surveyType];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const response = await axios.get(csvUrl);
  const lines = response.data.split(/\r?\n/);

  // External's header has no "Lat"/"Lon" columns at all, so also accept a header row that mentions
  // "Genus" (every sheet's species-name column phrasing includes that word).
  const headerIndex = lines.findIndex(
    (line) => (line.includes("Lat") && line.includes("Lon")) || line.includes("Genus")
  );
  if (headerIndex === -1) {
    throw new Error("Could not find header row in survey sheet");
  }

  const records = parse(lines.slice(headerIndex).join("\n"), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const locations = [];
  for (const record of records) {
    let lat = parseFloat(record.Lat);
    let lng = parseFloat(record.Lon);
    const coordsText = pick(record, ["Co-ordinates/Nearest Landmarks", "Coords/Nearest Landmarks"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const parsed = parseCoordsFromText(coordsText);
      if (parsed) {
        lat = parsed.lat;
        lng = parsed.lng;
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const lampPostNum = extractLampPostNumber(coordsText);
      if (lampPostNum) {
        const resolved = resolveLampPostCoords(lampPostNum, roadReferencePoints);
        if (resolved) {
          lat = resolved.lat;
          lng = resolved.lng;
        }
      }
    }
    const hasCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= 1.34 &&
      lat <= 1.359 &&
      lng >= 103.776 &&
      lng <= 103.8;

    // Bound to the surveyed Rifle Range Nature Park <-> ST Engineering stretch, treating stray/typo'd
    // coordinates as missing (lat/lng 0 below) rather than dropping the row entirely - the row itself is
    // still a real observation and needs to count toward totals/table/charts/filters, it just can't be
    // placed on the map. The frontend's map view filters out the uncoordinated rows itself.

    const [combinedStartTime, combinedEndTime] = pick(record, ["Survey Start Time and End Time"])
      .split(/\s+to\s+/)
      .map((value) => value.trim());

    locations.push({
      lat: hasCoords ? lat : 0,
      lng: hasCoords ? lng : 0,
      side: normalizeSide(
        pick(record, [
          "Which side of the road is it on? (N/S/On road)",
          "Which side of the road did it come from? (N/S)",
          "South/North",
        ])
      ),
      scientificName: pick(record, ["Scientific Name (Genus/Species)", "Genus/Species Name"]),
      commonName: pick(record, ["Common Name (If unavailable, sci name)", "Common Name"]),
      count: Number(record.Count) || 0,
      surveyors: pick(record, ["Name of Surveyors"]),
      surveyDate: pick(record, ["Survey Date"]),
      surveyStartTime: pick(record, ["Survey Start Time"]) || combinedStartTime || "",
      surveyEndTime: pick(record, ["Survey End Time"]) || combinedEndTime || "",
      timeOfObservation: pick(record, ["Time of Observation"]),
      taxa: pick(record, ["Taxa"]),
      isRoadkill: pick(record, ["Is it roadkill?", "Roadkill?"]),
      remarks: pick(record, ["Behaviours observed and/or other remarks", "Remarks"]),
      surveyId:
        pick(record, ["Survey ID"]) ||
        `${pick(record, ["Survey Date"])}-${record["S/No."] || ""}-${pick(record, ["Time of Observation"])}`,
      weatherConditions: pick(record, ["Weather Conditions"]),
      inatUsername: pick(record, ["iNat Username"]),
      imageUrl: pick(record, ["Image URL", "Upload any pictures if available."]),
      targetSpecies: pick(record, ["Target Species", "Target Species?"]),
      identified: pick(record, ["Identified?"]),
      coordsNearestLandmarks: pick(record, ["Coords/Nearest Landmarks", "Co-ordinates/Nearest Landmarks"]),
      surveyDirection: pick(record, ["Survey Direction"]),
      sideLR: pick(record, [
        "Which side of the road was it on? (L/R/On road)",
        "Which side of the road did it come from? (L/R)",
        "Which side of the road was it on?",
      ]),
      surveyType,
      crossingType: pick(record, ["Crossing Type"]),
      ropeBridgeId: pick(record, ["Rope Bridge ID"]),
      onRopeBridge: pick(record, ["Is the animal physically on the rope bridge?"]),
    });
  }

  if (surveyType === "Regular") {
    roadReferencePoints = locations
      .filter((location) => location.lat !== 0 || location.lng !== 0)
      .map((location) => ({ lat: location.lat, lng: location.lng }));
  }

  return locations;
};

// The "Species List" tab - Table A (Genus/Species) and Table B (higher taxonomic levels) both hold
// the conservation status reference, side-by-side in the same sheet.
const SPECIES_LIST_GID = "1784075874";

// Reads both tables of the Species List tab, keyed by scientific name.
export const fetchSpeciesList = async (sheetId) => {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${SPECIES_LIST_GID}`;
  const response = await axios.get(csvUrl);
  const lines = response.data.split(/\r?\n/);

  const headerIndex = lines.findIndex((line) => line.startsWith("Scientific Name"));
  if (headerIndex === -1) {
    throw new Error("Could not find Scientific Name header row in species list sheet");
  }

  const rows = parse(lines.slice(headerIndex + 1).join("\n"), {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const species = [];

  // Table A ("Genus and Species"): columns 0-5, runs the full length of the sheet with no gaps.
  for (const row of rows) {
    const scientificName = (row[0] || "").trim();
    if (!scientificName) continue;
    species.push({
      scientificName,
      commonName: (row[1] || "").trim(),
      taxa: (row[2] || "").trim(),
      targetSpecies: (row[3] || "").trim(),
      srdb3Status: (row[4] || "").trim(),
      iucnStatus: (row[5] || "").trim(),
      source: "Table A",
    });
  }

  // Table B ("Higher taxonomic levels"): columns 7-12, only a handful of rows right after the
  // header - stop at the first blank row so we don't fall into the sheet's unrelated
  // "Species Count" summary block further down, which reuses the same column range.
  for (const row of rows) {
    const scientificName = (row[7] || "").trim();
    if (!scientificName) break;
    species.push({
      scientificName,
      commonName: (row[8] || "").trim(),
      taxa: (row[9] || "").trim(),
      targetSpecies: (row[10] || "").trim(),
      srdb3Status: (row[11] || "").trim(),
      iucnStatus: (row[12] || "").trim(),
      source: "Table B",
    });
  }

  return species;
};

const norm = (value) => (value || "").trim().toLowerCase();

const percent = (part, total) => (total > 0 ? `${((part / total) * 100).toFixed(2)}%` : "0.00%");

// Computes the overview stat cards directly from every raw survey record instead of trusting the
// sheet's own pre-baked summary formulas, which were found to go stale/wrong once the data outgrew
// whatever cell range the formula was originally written for (e.g. a negative volunteer count, and
// "Target Species Recorded" stuck at 1 no matter how much data was added). Reads every row of the tab
// (not just the ones with valid map coordinates) so counts reflect the full table.
export const fetchSurveySummary = async (sheetId, surveyType = "Regular") => {
  const gid = SURVEY_LOCATIONS_GIDS[surveyType] ?? SURVEY_LOCATIONS_GIDS.Regular;
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const response = await axios.get(csvUrl);
  const lines = response.data.split(/\r?\n/);

  const headerIndex = lines.findIndex(
    (line) => (line.includes("Lat") && line.includes("Lon")) || line.includes("Genus")
  );
  if (headerIndex === -1) {
    throw new Error("Could not find header row in survey sheet");
  }

  const records = parse(lines.slice(headerIndex).join("\n"), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const surveyIds = new Set();
  const species = new Set();
  const targetSpecies = new Set();
  const volunteers = new Set();
  let totalIndividuals = 0;
  let targetIndividuals = 0;
  const cardinal = { north: 0, south: 0 };
  const relative = { left: 0, right: 0, onRoad: 0 };

  for (const record of records) {
    const scientificName = norm(pick(record, ["Scientific Name (Genus/Species)", "Genus/Species Name"]));
    const count = Number(record.Count) || 0;
    const isTarget = norm(pick(record, ["Target Species", "Target Species?"])) === "yes";
    const surveyId =
      pick(record, ["Survey ID"]) ||
      `${pick(record, ["Survey Date"])}-${record["S/No."] || ""}-${pick(record, ["Time of Observation"])}`;

    if (surveyId) surveyIds.add(surveyId);
    if (scientificName) species.add(scientificName);
    totalIndividuals += count;
    if (isTarget) {
      targetIndividuals += count;
      if (scientificName) targetSpecies.add(scientificName);
    }

    pick(record, ["Name of Surveyors"])
      .split(/[,&]/)
      .map((name) => norm(name))
      .filter(Boolean)
      .forEach((name) => volunteers.add(name));

    const cardinalAnswer = norm(
      pick(record, [
        "Which side of the road is it on? (N/S/On road)",
        "Which side of the road did it come from? (N/S)",
        "Which side of the road was it on?",
      ])
    );
    if (cardinalAnswer.startsWith("n")) cardinal.north++;
    else if (cardinalAnswer.startsWith("s")) cardinal.south++;

    const relativeAnswer = norm(
      pick(record, [
        "Which side of the road was it on? (L/R/On road)",
        "Which side of the road did it come from? (L/R)",
        "Which side of the road was it on?",
      ])
    );
    if (relativeAnswer.startsWith("l")) relative.left++;
    else if (relativeAnswer.startsWith("r")) relative.right++;
    else if (relativeAnswer.includes("on")) relative.onRoad++;
  }

  const items = [
    { label: "Total Number of Surveys", value: String(surveyIds.size) },
    { label: "Unique Species", value: String(species.size) },
    { label: "Target Species Recorded", value: String(targetSpecies.size) },
    { label: "Target Individuals Recorded", value: String(targetIndividuals) },
    { label: "Total Individuals Recorded", value: String(totalIndividuals) },
    { label: "Total Number of Volunteers", value: String(volunteers.size) },
  ];

  // Only show a side-of-the-road group when its underlying question actually has real answers on this
  // tab - e.g. External never asks a cardinal N/S question, so that group is skipped there entirely
  // instead of showing a row of meaningless 0.00% values.
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

