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

class Vehicle(BaseModel):
    id: int
    shift_start: int
    shift_end: int

class SolveRequest(BaseModel):
    vehicles: list[Vehicle]
    start_location_index: int
    locations: list[Location]
    travel_time_matrix: list[list[int]]

def compute_route(order: list[int], request: SolveRequest, shift_start: int):
    matrix = request.travel_time_matrix
    locations_by_index = {loc.index: loc for loc in request.locations} #locations_by_index = {0: <Location index=0, service=0, windows=...>, ...

    current_time = shift_start
    current_pos = request.start_location_index

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

    return stops, current_time - shift_start, violations

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
    matrix = request.travel_time_matrix
    depot = request.start_location_index
    num_vehicles = len(request.vehicles)

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

    manager = pywrapcp.RoutingIndexManager(len(new_matrix), num_vehicles, depot)
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return new_matrix[from_node][to_node] + service_times[from_node]

    transit_idx = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    horizon = max(v.shift_end for v in request.vehicles)
    routing.AddDimension(transit_idx, horizon, horizon, False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")

    for node_idx, window in enumerate(expanded_windows):
        if node_idx == depot:
            continue
        idx = manager.NodeToIndex(node_idx)
        time_dim.CumulVar(idx).SetRange(window[0], window[1])

    for group in twin_groups:
        if depot in group:
            continue
        indices = [manager.NodeToIndex(node) for node in group]
        routing.AddDisjunction(indices, 100_000)

    for v_idx, vehicle in enumerate(request.vehicles):
        time_dim.CumulVar(routing.Start(v_idx)).SetRange(vehicle.shift_start, vehicle.shift_end)
        time_dim.CumulVar(routing.End(v_idx)).SetRange(vehicle.shift_start, vehicle.shift_end)
        routing.AddVariableMinimizedByFinalizer(time_dim.CumulVar(routing.Start(v_idx)))
        routing.AddVariableMinimizedByFinalizer(time_dim.CumulVar(routing.End(v_idx)))

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    solution = routing.SolveWithParameters(search_params)

    all_clients = [loc.index for loc in request.locations if loc.index != depot]
    if not solution:
        return [[] for _ in request.vehicles], all_clients

    orders = []
    for v_idx in range(num_vehicles):
        order = []
        index = routing.Start(v_idx)
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != depot:
                order.append(node_to_location[node])
            index = solution.Value(routing.NextVar(index))
        orders.append(order)

    visited = {client for order in orders for client in order}
    dropped = [c for c in all_clients if c not in visited]

    return orders, dropped

@app.post("/solve")
def solve(request: SolveRequest):
    orders, dropped = solve_with_ortools(request)

    routes = []
    total_all = 0
    for vehicle, order in zip(request.vehicles, orders):
        stops, total, violations = compute_route(order, request, vehicle.shift_start)
        routes.append({
            "vehicle": vehicle.id,
            "stops": stops,
            "total_time_min": total,
            "window_violations": violations
        })
        total_all += total

    return {
        "routes": routes,
        "dropped": dropped,
        "total_time_min": total_all
    }
