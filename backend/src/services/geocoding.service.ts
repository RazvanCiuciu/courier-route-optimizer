import { ValidationError } from "../errors";
import * as clientsRepo from "../repositories/clients.repo";
import type { Client } from "../types/domain";

const NOMINATIM_URL = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";

export interface Coordinates {
    readonly lat: number;
    readonly lon: number;
}

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

async function throttle(): Promise<void> {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
    }
    lastRequestTime = Date.now();
}

export async function geocode(address: string): Promise<Coordinates> {
    await throttle();

    const url = new URL("/search", NOMINATIM_URL);
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ro");

    const response = await fetch(url, {
        headers: {
            "User-Agent": "courier-route-optimizer/0.2 (licenta)",
        },
    });

    if (!response.ok) {
        throw new Error(`Nominatim returned ${response.status}`);
    }

    const results = await response.json() as Array<{ lat: string; lon: string }>;

    if (results.length === 0) {
        throw new ValidationError(`Address not found: ${address}`);
    }

    const first = results[0]!;
    return { lat: Number(first.lat), lon: Number(first.lon) };
}

export async function ensureCoordinates(client: Client): Promise<Coordinates>{

    const lat = client.lat;
    const lon = client.lon;

    if(lat !== null && lon !== null)
    {
        return {lat,lon};
    }
    
    const coords = await geocode(client.address);
    await clientsRepo.updateCoordinates(client.id, coords.lat, coords.lon);
    return coords;

}