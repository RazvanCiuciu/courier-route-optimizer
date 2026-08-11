const SOLVER_URL = process.env.SOLVER_URL ?? "http://localhost:8000";

export interface SolverTimeWindow {
    readonly start: number;
    readonly end: number;
}

export interface SolverLocation {
    readonly index: number;
    readonly time_windows: SolverTimeWindow[];
    readonly service_time_min: number;
}

export interface SolverVehicle {
    readonly id: number;
    readonly shift_start: number;
    readonly shift_end: number;
    readonly max_stops?: number;
}

export interface SolveRequest {
    readonly vehicles: SolverVehicle[];
    readonly start_location_index: number;
    readonly locations: SolverLocation[];
    readonly travel_time_matrix: number[][];
}

export interface SolverStop {
    readonly index: number;
    readonly eta: number;
}

export interface SolverRoute {
    readonly vehicle: number;
    readonly stops: SolverStop[];
    readonly total_time_min: number;
    readonly window_violations: number;
}

export interface SolveResponse {
    readonly routes: SolverRoute[];
    readonly dropped: number[];
    readonly total_time_min: number;
}

export async function solve(request: SolveRequest): Promise<SolveResponse> {
    const response = await fetch(`${SOLVER_URL}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Solver returned ${response.status}: ${text}`);
    }

    return await response.json() as SolveResponse;
}