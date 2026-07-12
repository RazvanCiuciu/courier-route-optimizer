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

def compute_route(order: list[int], request: SolveRequest):
    courier = request.courier
    matrix = request.travel_time_matrix
    locations_by_index = {loc.index: loc for loc in request.locations}

    current_time = courier.shift_start
    current_pos = courier.start_location_index

    stops = []
    for idx in order:
        loc = locations_by_index[idx]        
        current_time += matrix[current_pos][idx]
        stops.append({"index": idx, "eta": current_time})
        current_time += loc.service_time_min
        current_pos = idx

    return stops, current_time - courier.shift_start

@app.post("/solve")
def solve(request: SolveRequest):
    
    echo_order = [loc.index for loc in request.locations
                  if loc.index != request.courier.start_location_index]
    stops, total = compute_route(echo_order, request)

    return {
        "routes": [{"vehicle": 0, "stops": stops}],
        "dropped": [],
        "total_time_min": total
    }

###intrbare de pus: in compute route care e faza cu loc???