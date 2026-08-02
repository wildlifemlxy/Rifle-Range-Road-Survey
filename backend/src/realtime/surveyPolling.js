import { fetchSurveyLocations } from "../api/googleSheetsApi.js";

const POLL_INTERVAL_MS = 60_000;
const SURVEY_TYPES = ["Regular", "Rope Bridge", "External"];

// Cheap fingerprint (row count + survey IDs) - good enough to detect inserted/removed/edited rows
// without diffing every field, since the sheet is fetched fresh each poll anyway.
const fingerprint = (locations) => `${locations.length}:${locations.map((l) => l.surveyId).join(",")}`;

// The survey data lives in a Google Sheet edited by volunteers outside this app, so there's no
// database change-stream to hook into - instead poll both survey tabs periodically and emit a
// socket event when a change is detected, so connected clients know to refetch.
export const startSurveyPolling = (io, sheetId) => {
  const lastFingerprints = new Map();

  const poll = async () => {
    for (const surveyType of SURVEY_TYPES) {
      try {
        const locations = await fetchSurveyLocations(sheetId, surveyType);
        const fp = fingerprint(locations);
        const previous = lastFingerprints.get(surveyType);
        lastFingerprints.set(surveyType, fp);

        if (previous !== undefined && previous !== fp) {
          console.log(`Detected change in "${surveyType}" survey data - notifying clients`);
          io.emit("surveyDataUpdated", { surveyType });
        }
      } catch (error) {
        console.error(`Failed to poll "${surveyType}" survey data`, error);
      }
    }
  };

  poll();
  setInterval(poll, POLL_INTERVAL_MS);
};
