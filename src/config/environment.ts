import dotenv from "dotenv";
import { Client, Language } from "@googlemaps/google-maps-services-js";

dotenv.config();

export interface Config {
    googleMapsApiKey: string;
    defaultLanguage: Language;
    defaultRegion: string;
}

const config: Config = {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    defaultLanguage: (process.env.DEFAULT_LANGUAGE || "en") as Language,
    defaultRegion: process.env.DEFAULT_REGION || "US",
};

if (!config.googleMapsApiKey) {
    throw new Error(
        "Google Maps API key is required. Please set GOOGLE_MAPS_API_KEY environment variable."
    );
}

export const googleMapsClient = new Client({});

export default config;
