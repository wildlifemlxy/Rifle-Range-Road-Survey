import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const PORT = process.env.PORT || 3001;
export const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
