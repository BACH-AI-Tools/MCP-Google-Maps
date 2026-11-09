import { MapDirectionsService } from "../src/services/map-directions";

describe("MapDirectionsService.getMapWithDirections", () => {
    const service = new MapDirectionsService();
    const accra = { address: "Accra, Ghana", lat: 5.6037, lng: -0.187 };

    it("accepts an origin at lat 0 / lng 0 (Null Island)", async () => {
        const result = await service.getMapWithDirections({
            origin: { address: "Null Island", lat: 0, lng: 0 },
            destination: accra,
        });
        expect(result.error).toBeUndefined();
        expect(result.success).toBe(true);
        expect(result.data?.staticMapUrl).toContain("label:A|0,0");
    });

    it("accepts a destination on the equator (lat 0)", async () => {
        const result = await service.getMapWithDirections({
            origin: accra,
            destination: { address: "Equator, Gabon", lat: 0, lng: 9.5 },
        });
        expect(result.success).toBe(true);
    });

    it("accepts a destination on the prime meridian (lng 0)", async () => {
        const result = await service.getMapWithDirections({
            origin: accra,
            destination: { address: "Greenwich", lat: 51.4779, lng: 0 },
        });
        expect(result.success).toBe(true);
    });

    it("accepts a waypoint at 0,0", async () => {
        const result = await service.getMapWithDirections({
            origin: accra,
            destination: { address: "Greenwich", lat: 51.4779, lng: 0 },
            waypoints: [{ address: "Null Island", lat: 0, lng: 0 }],
        });
        expect(result.success).toBe(true);
        expect(result.data?.summary.waypoints).toEqual(["Null Island"]);
    });

    it("still rejects a missing coordinate", async () => {
        const result = await service.getMapWithDirections({
            origin: { address: "Nowhere" } as any,
            destination: accra,
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain("Origin must include address, lat, and lng");
    });

    it("rejects out-of-range coordinates", async () => {
        const result = await service.getMapWithDirections({
            origin: accra,
            destination: { address: "Bad", lat: 91, lng: 0 },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid latitude");
    });
});
