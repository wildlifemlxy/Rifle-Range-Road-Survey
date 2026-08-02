import { GOOGLE_MAPS_API_KEY } from "../config/env.js";
import { geocodeAddress, getDirections } from "../api/googleMapsApi.js";

export const getMapConfig = (_req, res) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ success: false, error: "GOOGLE_MAPS_API_KEY is not configured" });
  }

  res.json({ success: true, apiKey: GOOGLE_MAPS_API_KEY });
};

export const getGeocode = async (req, res) => {
  const address = req.body?.address;

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ success: false, error: "GOOGLE_MAPS_API_KEY is not configured" });
  }
  if (!address) {
    return res.status(400).json({ success: false, error: "address is required" });
  }

  try {
    const { location, bounds } = await geocodeAddress(address, GOOGLE_MAPS_API_KEY);
    res.json({ success: true, location, bounds });
  } catch (error) {
    console.error("Failed to geocode address", error);
    res.status(502).json({ success: false, error: "Failed to geocode address" });
  }
};

export const getRouteDirections = async (req, res) => {
  const { origin, destination } = req.body || {};

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ success: false, error: "GOOGLE_MAPS_API_KEY is not configured" });
  }
  if (!origin || !destination) {
    return res.status(400).json({ success: false, error: "origin and destination are required" });
  }

  try {
    const { bounds, overviewPolyline } = await getDirections(origin, destination, GOOGLE_MAPS_API_KEY);
    res.json({ success: true, bounds, overviewPolyline });
  } catch (error) {
    console.error("Failed to fetch directions", error);
    res.status(502).json({ success: false, error: "Failed to fetch directions" });
  }
};
