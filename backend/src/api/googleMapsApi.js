import axios from "axios";

// Calls the Google Maps Geocoding API server-side so the key never leaves the backend.
export const geocodeAddress = async (address, apiKey) => {
  const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
    params: { address, key: apiKey },
  });

  const result = response.data?.results?.[0];
  if (response.data.status !== "OK" || !result) {
    throw new Error(`Geocoding failed: ${response.data.status}`);
  }

  return {
    location: result.geometry.location,
    bounds: result.geometry.bounds || result.geometry.viewport,
  };
};

// Calls the Google Directions API server-side to get the route between two points on Rifle Range Road.
export const getDirections = async (origin, destination, apiKey) => {
  const response = await axios.get("https://maps.googleapis.com/maps/api/directions/json", {
    params: { origin, destination, key: apiKey },
  });

  const route = response.data?.routes?.[0];
  if (response.data.status !== "OK" || !route) {
    throw new Error(`Directions request failed: ${response.data.status}`);
  }

  return {
    bounds: route.bounds,
    overviewPolyline: route.overview_polyline.points,
  };
};
