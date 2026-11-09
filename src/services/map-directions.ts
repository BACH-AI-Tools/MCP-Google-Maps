import { TravelMode } from "@googlemaps/google-maps-services-js";
import { ServiceResponse } from "../types";
import { handleError, validateCoordinates } from "../utils/error-handling";
import config from "../config/environment";

export interface Location {
    address: string;
    lat: number;
    lng: number;
}

function isValidLocation(loc: Location | undefined): loc is Location {
    return (
        !!loc &&
        !!loc.address &&
        typeof loc.lat === "number" &&
        Number.isFinite(loc.lat) &&
        typeof loc.lng === "number" &&
        Number.isFinite(loc.lng)
    );
}

export interface MapDirectionsParams {
    origin: Location;
    destination: Location;
    waypoints?: Location[];
    mode?: TravelMode;
    size?: { width: number; height: number };
    scale?: number;
    mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
}

export interface MapDirectionsResponse {
    googleMapsUrl: string;
    staticMapUrl: string;
    summary: {
        origin: string;
        destination: string;
        waypoints?: string[];
        mode: string;
    };
}

export class MapDirectionsService {
    /**
     * Generate Google Maps URL with waypoints
     */
    private buildGoogleMapsUrl(params: MapDirectionsParams): string {
        const baseUrl = "https://www.google.com/maps/dir/";
        const urlParams = new URLSearchParams({
            api: "1",
            origin: params.origin.address,
            destination: params.destination.address,
            travelmode: params.mode || TravelMode.driving,
        });

        if (params.waypoints && params.waypoints.length > 0) {
            const waypointAddresses = params.waypoints
                .map((wp) => wp.address)
                .join("|");
            urlParams.append("waypoints", waypointAddresses);
        }

        return `${baseUrl}?${urlParams.toString()}`;
    }

    /**
     * Generate static map URL with markers and path
     */
    private generateStaticMapUrl(params: MapDirectionsParams): string {
        const baseUrl = "https://maps.googleapis.com/maps/api/staticmap";

        // Build all locations array
        const allLocations = [
            params.origin,
            ...(params.waypoints || []),
            params.destination,
        ];

        // Create markers
        const markers = [
            // Origin marker (green, label A)
            `markers=size:mid|color:green|label:A|${params.origin.lat},${params.origin.lng}`,
            // Destination marker (red, with appropriate letter)
            `markers=size:mid|color:red|label:${String.fromCharCode(65 + allLocations.length - 1)}|` +
                `${params.destination.lat},${params.destination.lng}`,
        ];

        // Add waypoint markers (blue, labels B, C, etc.)
        if (params.waypoints) {
            params.waypoints.forEach((wp, i) => {
                markers.push(
                    `markers=size:mid|color:blue|label:${String.fromCharCode(66 + i)}|${wp.lat},${wp.lng}`
                );
            });
        }

        // Create path connecting all points
        const pathPoints = allLocations
            .map((loc) => `${loc.lat},${loc.lng}`)
            .join("|");
        const path = `path=color:0x4285F4|weight:4|${pathPoints}`;

        // Build URL parameters
        const urlParams = new URLSearchParams({
            key: config.googleMapsApiKey,
            size: `${params.size?.width || 640}x${params.size?.height || 480}`,
            scale: (params.scale || 2).toString(),
            maptype: params.mapType || "roadmap",
        });

        // Combine everything
        // Caution !!!Do not send this URL to the client directly, as it contains API key!!!
        return `${baseUrl}?${urlParams}&${markers.join("&")}&${path}`;
    }

    /**
     * Generate map with directions - simplified for
     */
    async getMapWithDirections(
        params: MapDirectionsParams
    ): Promise<ServiceResponse<MapDirectionsResponse>> {
        try {
            // Validate required fields. Use explicit numeric checks: 0 is a
            // valid latitude/longitude (equator, prime meridian).
            if (!isValidLocation(params.origin)) {
                throw new Error("Origin must include address, lat, and lng");
            }
            if (!isValidLocation(params.destination)) {
                throw new Error(
                    "Destination must include address, lat, and lng"
                );
            }

            // Validate waypoints if provided
            if (params.waypoints) {
                for (const wp of params.waypoints) {
                    if (!isValidLocation(wp)) {
                        throw new Error(
                            "Each waypoint must include address, lat, and lng"
                        );
                    }
                }
            }

            for (const loc of [
                params.origin,
                ...(params.waypoints || []),
                params.destination,
            ]) {
                validateCoordinates(loc.lat, loc.lng);
            }

            // Generate URLs
            const googleMapsUrl = this.buildGoogleMapsUrl(params);
            const staticMapUrl = this.generateStaticMapUrl(params);

            // Create summary
            const summary = {
                origin: params.origin.address,
                destination: params.destination.address,
                waypoints: params.waypoints?.map((wp) => wp.address),
                mode: params.mode || TravelMode.driving,
            };

            return {
                success: true,
                data: {
                    googleMapsUrl,
                    staticMapUrl,
                    summary,
                },
            };
        } catch (error) {
            return handleError(error);
        }
    }
}
