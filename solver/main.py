from fastapi import FastAPI
from pydantic import BaseModel
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

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
    locations_by_index = {loc.index: loc for loc in request.locations} #locations_by_index = {0: <Location index=0, service=0, windows=...>, ...

    current_time = courier.shift_start
    current_pos = courier.start_location_index

    stops = []
    violations = 0

    for idx in order:
        loc = locations_by_index[idx]
        arrival = current_time + matrix[current_pos][idx]     
        window = None
        sorted_windows = sorted(loc.time_windows, key=lambda w: w.start)
        for w in sorted_windows:
            if w.end >= arrival:
                window = w
                break

        if not loc.time_windows:
            service_start = arrival         
        elif window is None:
            violations += 1                 
            service_start = arrival
        else:
            service_start = max(arrival, window.start)

        stops.append({"index": idx, "eta": service_start})
        current_time = service_start + loc.service_time_min
        current_pos = idx

    return stops, current_time - courier.shift_start, violations

def expand_locations(locations, matrix):
    twin_groups = []
    node_to_location = {}
    expanded_windows = []

    N = len(locations)

    for i in range(N):
        expanded_windows.append(locations[i][0])
        node_to_location[i] = i
        twin_groups.append([i])
        
    new_node_id = N
    for i in range(N):
        if len(locations[i]) > 1:
            for j in locations[i][1:]:
                expanded_windows.append(j)
                node_to_location[new_node_id] = i
                twin_groups[i].append(new_node_id)
                new_node_id += 1

    new_matrix= []
    total_nodes = len(node_to_location)
    
    for i in range(total_nodes):
        row = []
        for j in range(total_nodes):
            val_i = node_to_location[i]
            val_j = node_to_location[j]
            row.append(matrix[val_i][val_j])
        new_matrix.append(row)
                    
    return new_matrix, expanded_windows, node_to_location, twin_groups

def solve_with_ortools(request: SolveRequest):
    courier = request.courier
    matrix = request.travel_time_matrix

    locations_windows = [
        [(w.start, w.end) for w in loc.time_windows]
        for loc in request.locations
    ]

    new_matrix, expanded_windows, node_to_location, twin_groups = expand_locations(
        locations_windows, matrix
    )

    locations_by_index = {loc.index: loc for loc in request.locations}
    service_times = [
        locations_by_index[node_to_location[node]].service_time_min
        for node in range(len(new_matrix))
    ]

    manager = pywrapcp.RoutingIndexManager(len(new_matrix), 1, courier.start_location_index)
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return new_matrix[from_node][to_node] + service_times[from_node]

    transit_idx = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    routing.AddDimension(transit_idx, courier.shift_end, courier.shift_end, False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")

    for node_idx, window in enumerate(expanded_windows):
        if node_idx == courier.start_location_index:
            continue
        idx = manager.NodeToIndex(node_idx)
        time_dim.CumulVar(idx).SetRange(window[0], window[1])

    for group in twin_groups:
        if courier.start_location_index in group:
            continue
        indices = [manager.NodeToIndex(node) for node in group]
        routing.AddDisjunction(indices, 100_000)

    depot_window = expanded_windows[courier.start_location_index]
    start_idx = routing.Start(0)
    time_dim.CumulVar(start_idx).SetRange(depot_window[0], depot_window[1])
    routing.AddVariableMinimizedByFinalizer(time_dim.CumulVar(routing.Start(0)))
    routing.AddVariableMinimizedByFinalizer(time_dim.CumulVar(routing.End(0)))

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    solution = routing.SolveWithParameters(search_params)

    all_clients = [loc.index for loc in request.locations if loc.index != courier.start_location_index]
    if not solution:
        return [], all_clients

    order = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node != courier.start_location_index:
            order.append(node_to_location[node])
        index = solution.Value(routing.NextVar(index))

    visited_clients = set(order)
    dropped = [c for c in all_clients if c not in visited_clients]

    return order, dropped

@app.post("/solve")
def solve(request: SolveRequest):
    order, dropped = solve_with_ortools(request)
    stops, total, violations = compute_route(order, request)

    return {
        "routes": [{"vehicle": 0, "stops": stops}],
        "dropped": dropped,
        "total_time_min": total,
        "window_violations" : violations
    }   

