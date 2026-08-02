import { Router } from "express";
import { getSurveyData, getSurveyLocations, getSurveySummary, getSpeciesList } from "../Controllers/surveyController.js";

const router = Router();

router.post("/survey-data", getSurveyData);
router.post("/survey-locations", getSurveyLocations);
router.post("/survey-summary", getSurveySummary);
router.post("/species-list", getSpeciesList);

export default router;
