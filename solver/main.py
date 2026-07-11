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
    shift_star: int
    shift_end: int
    start_location_index: int

class SolveRequest(BaseModel):
    courier: Courier
    locations: list[Location]
    travel_time_matrix: list[list[int]]
    num_vechicles: int

@app.post("/solve")
def solve(request: SolveRequest):
    return {
        "routes": [],
        "dropped": [],
        "total_time_min": 0
    }
