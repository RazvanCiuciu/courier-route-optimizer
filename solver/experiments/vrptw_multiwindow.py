"""Vehicles Routing Problem (VRP) with Time Windows."""

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from main import expand_locations
from main import solve_with_ortools, SolveRequest
import random
from time import perf_counter

def create_data_model():
    """Stores the data for the problem."""
    data = {}
    data["time_matrix"] = [
        [0, 6, 9, 8, 7, 3, 6, 2, 3, 2],
        [6, 0, 8, 3, 2, 6, 8, 4, 8, 8],
        [9, 8, 0, 11, 10, 6, 3, 9, 5, 8],
        [8, 3, 11, 0, 1, 7, 10, 6, 10, 10],
        [7, 2, 10, 1, 0, 6, 9, 4, 8, 9],
        [3, 6, 6, 7, 6, 0, 2, 3, 2, 2],
        [6, 8, 3, 10, 9, 2, 0, 6, 2, 5],
        [2, 4, 9, 6, 4, 3, 6, 0, 4, 4],
        [3, 8, 5, 10, 8, 2, 2, 4, 0, 3],
        [2, 8, 8, 10, 9, 2, 5, 4, 3, 0],
    ]
    data["time_windows"] = [
        [(600, 1290)],              
        [(600, 1290)],             
        [(610, 680)],              
        [(600, 1290)],              
        [(610, 680), (1020, 1140), (1200,1210)], 
        [(700, 800)],               
        [(600, 1290)],   
        [(1020, 1100)],  
        [(650, 720)],    
        [(600, 1290)],   
    ]
    data["num_vehicles"] = 1
    data["depot"] = 0
    return data

def print_solution(data, manager, routing, solution):
    """Prints solution on console."""
    print(f"Objective: {solution.ObjectiveValue()}")
    time_dimension = routing.GetDimensionOrDie("Time")
    total_time = 0
    for vehicle_id in range(data["num_vehicles"]):
        if not routing.IsVehicleUsed(solution, vehicle_id):
            continue
        index = routing.Start(vehicle_id)
        plan_output = f"Route for vehicle {vehicle_id}:\n"
        while not routing.IsEnd(index):
            time_var = time_dimension.CumulVar(index)
            plan_output += (
                f"{manager.IndexToNode(index)}"
                f" Time({solution.Min(time_var)},{solution.Max(time_var)})"
                " -> "
            )
            index = solution.Value(routing.NextVar(index))
        time_var = time_dimension.CumulVar(index)
        plan_output += (
            f"{manager.IndexToNode(index)}"
            f" Time({solution.Min(time_var)},{solution.Max(time_var)})\n"
        )
        plan_output += f"Time of the route: {solution.Min(time_var)}min\n"
        print(plan_output)
        total_time += solution.Min(time_var)
    print(f"Total time of all routes: {total_time}min")


def main():
    """Solve the VRP with time windows."""

    # Instantiate the data problem.
    data = create_data_model()
    new_matrix, expanded_windows, node_to_location, twin_groups = expand_locations(
        data["time_windows"], data["time_matrix"]
)

    #aici o sa am eu datele mele, time_matrix, time_windows, num_vehicles, depot (start index)
    #de observat ca in cazul asta am un singur timeWindow per locatie, in timp ce eu posibil sa am mai multe (daca un client nu poate intre 2-5 automat am 2 timewindows)
 
    # Create the routing index manager.
    manager = pywrapcp.RoutingIndexManager(
        len(new_matrix), data["num_vehicles"], data["depot"]
    )

    # Create Routing Model.
    routing = pywrapcp.RoutingModel(manager)
    
    #aici folosesc OR-Tools ca sa creez index manager si routing model 
    #RoutingIndexManager traduce informatile pe care ii le dau eu intr un mod in care OR-Tools le intelege
    #RoutingModel creeaza un routin model pe baza managerului 

    # Create and register a transit callback.
    def time_callback(from_index, to_index):
        """Returns the travel time between the two nodes."""
        # Convert from routing variable Index to time matrix NodeIndex.
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return new_matrix[from_node][to_node]
    #aici mi ar da timpul pe care l as face de la nodul from la nodul to 
    
    
    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    #OR-Tools e C++ si de aia nu poate vedea functii pyhton direct
    #RegisterTransitCallback e o predare a functie pe care Or-Tools o inregistrez la el in tabel si im da inapoi un index pentru unde sta functia in tabel
    

    # Define cost of each arc.
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    # folosind functia time_callback dau o valoare fiecarui drum dintre 2 locatii



    # Add Time Windows constraint.
    time = "Time"
    routing.AddDimension(
        transit_callback_index, # functia de callback(ce imi da timpul dintr 2 locatii)
        1290,  # cat am voie maxim sa stau dupa un client in cazul meu
        1290,  # cand se termina ziua
        False,  # nu sunt fortat sa plec cu toate vechiculele la timpul 0
        time, #numele
    )
    #concept central la Or-Tools Routing
    #o "dimensiune" este o cantitate care se acumuleaza de a lungul rutei, in cazul meu timpul


    time_dimension = routing.GetDimensionOrDie(time)
    # Add time window constraints for each location except depot.
    for node_idx, window in enumerate(expanded_windows):
        if node_idx == data["depot"]:
            continue
        index = manager.NodeToIndex(node_idx)
        time_dimension.CumulVar(index).SetRange(window[0], window[1])
    #se pun constrangerile de timp pe fiacere nod

    for group in twin_groups:
        if data["depot"] in group:
            continue
        indices = [manager.NodeToIndex(node) for node in group]
        routing.AddDisjunction(indices, 100_000)

    # Add time window constraints for each vehicle start node.
    depot_window = expanded_windows[data["depot"]]
    for vehicle_id in range(data["num_vehicles"]):
        index = routing.Start(vehicle_id)
        time_dimension.CumulVar(index).SetRange(depot_window[0], depot_window[1])
    #aici dau programul de lucru pentru fiecare vehicul

    # Instantiate route start and end times to produce feasible times.
    for i in range(data["num_vehicles"]):
        routing.AddVariableMinimizedByFinalizer(
            time_dimension.CumulVar(routing.Start(i))
        )
        routing.AddVariableMinimizedByFinalizer(time_dimension.CumulVar(routing.End(i)))
    #face ca start-ul si end-ul ficarui vehicul sa fie cea mai mica val posibila

    # Setting first solution heuristic.
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    #aici setez strategia de rezolvare folosing PATH_CHEAPEST_ARC care este foarte un NN imporved

   # Solve the problem.
    t0 = perf_counter()
    solution = routing.SolveWithParameters(search_parameters)
    print(f"solve: {perf_counter() - t0:.3f}s")
    #aici e rezolvata problema in sine

    # Print solution on console.
    if solution:
        print_solution(data, manager, routing, solution)


if __name__ == "__main__":
    main()
