import type { Coordinates } from "./geocoding.service";

const OSRM_URL = process.env.OSRM_URL ?? "http://localhost:5000";

export async function getTravelTimeMatrix(
    coords: readonly Coordinates[]
): Promise<number[][]> {
    const coordString = coords.map(c => `${c.lon},${c.lat}`).join(";");

    const response = await fetch(`${OSRM_URL}/table/v1/driving/${coordString}?annotations=duration`);

    if (!response.ok) {
        throw new Error(`OSRM returned ${response.status}`);
    }

    const data = await response.json() as {
        code: string;
        message?: string;
        durations?: number[][];
    };

    if(data.code !== "Ok"){
        throw new Error(`OSRM error: ${data.code} — ${data.message ?? "no message"}`);
    }

    return data.durations!.map(row => row.map(sec => Math.round(sec / 60)));
}