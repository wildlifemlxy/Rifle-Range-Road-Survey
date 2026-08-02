import { GOOGLE_SHEET_ID } from "../config/env.js";
import { fetchSurveyRecords, fetchSurveyLocations, fetchSurveySummary, fetchSpeciesList } from "../api/googleSheetsApi.js";

const isSurveyType = (value) => value === "Regular" || value === "Rope Bridge" || value === "External";

export const getSurveyData = async (_req, res) => {
  if (!GOOGLE_SHEET_ID) {
    return res.status(500).json({ error: "GOOGLE_SHEET_ID is not configured" });
  }

  try {
    const records = await fetchSurveyRecords(GOOGLE_SHEET_ID);
    res.json(records);
  } catch (error) {
    console.error("Failed to fetch survey data", error);
    res.status(502).json({ error: "Failed to fetch survey data" });
  }
};

export const getSurveyLocations = async (req, res) => {
  if (!GOOGLE_SHEET_ID) {
    return res.status(500).json({ success: false, error: "GOOGLE_SHEET_ID is not configured" });
  }

  const surveyType = isSurveyType(req.body?.surveyType) ? req.body.surveyType : "Regular";

  try {
    const locations = await fetchSurveyLocations(GOOGLE_SHEET_ID, surveyType);
    res.json({ success: true, locations });
  } catch (error) {
    console.error("Failed to fetch survey locations", error);
    res.status(502).json({ success: false, error: "Failed to fetch survey locations" });
  }
};

export const getSurveySummary = async (req, res) => {
  if (!GOOGLE_SHEET_ID) {
    return res.status(500).json({ success: false, error: "GOOGLE_SHEET_ID is not configured" });
  }

  const surveyType = isSurveyType(req.body?.surveyType) ? req.body.surveyType : "Regular";

  try {
    const summary = await fetchSurveySummary(GOOGLE_SHEET_ID, surveyType);
    res.json({ success: true, summary });
  } catch (error) {
    console.error("Failed to fetch survey summary", error);
    res.status(502).json({ success: false, error: "Failed to fetch survey summary" });
  }
};

export const getSpeciesList = async (_req, res) => {
  if (!GOOGLE_SHEET_ID) {
    return res.status(500).json({ success: false, error: "GOOGLE_SHEET_ID is not configured" });
  }

  try {
    const species = await fetchSpeciesList(GOOGLE_SHEET_ID);
    res.json({ success: true, species });
  } catch (error) {
    console.error("Failed to fetch species list", error);
    res.status(502).json({ success: false, error: "Failed to fetch species list" });
  }
};
