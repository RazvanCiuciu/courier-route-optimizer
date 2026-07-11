from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class TimeWindow(BaseModel):
    start: int
    end : int

class Location(BaseModel):
    index: int
    time_windows: list[TimeWindow]
    service_time_min: int

class Courier(BaseModel):
    shift_start: int
    shift_end: int
    start_location_index: int

class SolveRequest(BaseModel):
    courier: Courier
    locations: list[Location]
    travel_time_matrix: list[list[int]]
    num_vehicles : int

@app.post("/solve")
def solve(request: SolveRequest):
    
    courier = request.courier
    matrix = request.travel_time_matrix

    current_time = courier.shift_start # delivery starts at  10:00
    current_pos = courier.start_location_index # starting location is the store

    stops = []
    for loc in request.locations:
        if loc.index == courier.start_location_index:
            continue
        current_time += matrix[current_pos][loc.index]
        stops.append({"index" : loc.index, "eta": current_time})
        current_time += loc.service_time_min
        current_pos = loc.index

    return {
        "routes": [{"vehicle": 0, "stops": stops}],
        "dropped": [],
        "total_time_min": current_time - courier.shift_start
    }
