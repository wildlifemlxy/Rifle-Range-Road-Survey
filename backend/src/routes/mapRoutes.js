import { Router } from "express";
import { getMapConfig, getGeocode, getRouteDirections } from "../Controllers/mapController.js";

const router = Router();

router.post("/config", getMapConfig);
router.post("/geocode", getGeocode);
router.post("/directions", getRouteDirections);

export default router;
