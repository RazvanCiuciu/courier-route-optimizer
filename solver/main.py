from fastapi import FastAPI
from pydantic import BaseModel
from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from heuristics import (nearest_neighbor_tw, two_opt_tw, manual_order,
                        route_duration, count_violations)

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
    max_stops: int = 60

class SolveRequest(BaseModel):
    vehicles: list[Vehicle]
    start_location_index: int
    locations: list[Location]
    travel_time_matrix: list[list[int]]
    coords: list[dict] | None = None

def compute_route(order: list[int], request: SolveRequest, shift_start: int):
    matrix = request.travel_time_matrix
    locations_by_index = {loc.index: loc for loc in request.locations} 

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


    def demand_callback(from_index):
        node = manager.IndexToNode(from_index)
        return 0 if node == depot else 1

    demand_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_idx,
        0,                                          
        [v.max_stops for v in request.vehicles],    
        True,                                      
        "Count"
    )

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


@app.post("/compare")
def compare(request: SolveRequest):
    import time

    depot = request.start_location_index
    matrix = request.travel_time_matrix
    clients = [loc.index for loc in request.locations if loc.index != depot]
    shift_start = request.vehicles[0].shift_start

    windows_by_node = {
        loc.index: [(w.start, w.end) for w in loc.time_windows]
        for loc in request.locations
    }
    service_by_node = {
        loc.index: loc.service_time_min for loc in request.locations
    }
    service = service_by_node[clients[0]] if clients else 0

    results = []

    t0 = time.perf_counter()
    order_manual = manual_order(clients, request.coords)
    t_manual = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    order_nn = nearest_neighbor_tw(matrix, depot, clients, windows_by_node,
                                   service, shift_start)
    t_nn = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    order_2opt = two_opt_tw(order_nn, matrix, depot, windows_by_node,
                            service, shift_start)
    t_2opt = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    orders_ortools, dropped = solve_with_ortools(request)
    t_ortools = (time.perf_counter() - t0) * 1000
    order_ortools = orders_ortools[0] if orders_ortools else []

    for name, order, elapsed in [
        ("manual", order_manual, t_manual),
        ("nn_tw", order_nn, t_nn),
        ("nn_2opt_tw", order_2opt, t_2opt),
        ("ortools", order_ortools, t_ortools),
    ]:
        stops, total, violations = compute_route(order, request, shift_start)

        drive = sum(
            matrix[a][b]
            for a, b in zip([depot] + order, order + [depot])
        )
        service_total = sum(service_by_node[n] for n in order)

        results.append({
            "method": name,
            "order": order,
            "stops_detail": stops,
            "stops": len(order),
            "total_time_min": total,
            "drive_time_min": drive,
            "service_time_min": service_total,
            "wait_time_min": max(0, total - drive - service_total),
            "window_violations": violations,
            "compute_time_ms": round(elapsed, 2),
        })

    return {"results": results, "dropped_ortools": dropped}