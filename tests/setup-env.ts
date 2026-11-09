// src/config/environment.ts throws at import time without an API key.
// Tests never hit the network, so a dummy key is enough.
process.env.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "test-api-key";
