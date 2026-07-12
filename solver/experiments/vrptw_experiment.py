"""Vehicles Routing Problem (VRP) with Time Windows."""

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

import random

def fake_travel_matrix(n: int) -> list[list[int]]:
    """Traducerea fakeTravelMatrix din warmup: simetrica, diagonala 0, valori 5-25."""
    # TODO tu — aceeasi logica de acum 4 zile:
    #   matrice n x n; m[i][i] = 0; pentru j < i copiezi m[j][i]; altfel random.randint(5, 25)
    #   (random.randint e INCLUSIV la ambele capete — mai simplu ca Math.floor(Math.random()...))
    #   constructia: fie liste imbricate cu append (stilul tau), fie comprehension — alegerea ta
    travel_matrix: list[list[int]] = []
    
    for i in range(n):
        row: list[int] = []
        for j in range(n):
            if i == j:
                row.append(0)
            elif j < i:
                row.append(travel_matrix[j][i])
            else:
                row.append(random.randint(5,25))
        travel_matrix.append(row)
        
    return travel_matrix


def create_data_model():
    data = {}
    random.seed(42)                      # IMPORTANT: reproducibil — aceeasi matrice la fiecare rulare
    data["time_matrix"] = fake_travel_matrix(10)
    data["time_windows"] = [
        (600, 1290),   # 0 depot — pleci la 10:00, orizont 21:30
        (600, 1290),   # 1 "oricand" — flexibilul clasic
        (610, 680),    # 2 fereastra STRANSA devreme — trebuie prins repede
        (600, 1290),   # 3 oricand
        (1020, 1140),  # 4 "dupa 17" — clientul tau tipic de seara
        (700, 800),    # 5 mijloc de zi, moderata
        (600, 1290),   # 6 oricand
        (1020, 1100),  # 7 INCA unul de seara — se bat pe acelasi interval cu 4
        (650, 720),    # 8 devreme-mediu, se suprapune partial cu 2
        (600, 1290),   # 9 oricand
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

    #aici o sa am eu datele mele, time_matrix, time_windows, num_vehicles, depot (start index)
    #de observat ca in cazul asta am un singur timeWindow per locatie, in timp ce eu posibil sa am mai multe (daca un client nu poate intre 2-5 automat am 2 timewindows)
 
    # Create the routing index manager.
    manager = pywrapcp.RoutingIndexManager(
        len(data["time_matrix"]), data["num_vehicles"], data["depot"]
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
        return data["time_matrix"][from_node][to_node]
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
    for location_idx, time_window in enumerate(data["time_windows"]):
        if location_idx == data["depot"]:
            continue
        index = manager.NodeToIndex(location_idx)
        time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])
    #se pun constrangerile de timp pe fiacere nod

    # Add time window constraints for each vehicle start node.
    depot_idx = data["depot"]
    for vehicle_id in range(data["num_vehicles"]):
        index = routing.Start(vehicle_id)
        time_dimension.CumulVar(index).SetRange(
            data["time_windows"][depot_idx][0], data["time_windows"][depot_idx][1]
        )
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
    solution = routing.SolveWithParameters(search_parameters)
    #aici e rezolvata problema in sine

    # Print solution on console.
    if solution:
        print_solution(data, manager, routing, solution)


if __name__ == "__main__":
    main()


#   Categorie      intrebarea la care raspunde     COD

#   Constrangeri   ce e permis?                    SetRange, dimensiunea cu plafonul 30

#   Obiectiv       ce e mai bun?                   SetArcCostEvaluator (+ finalizer-ele, rangul 2)

#   Strategie      cum caut?                       PATH_CHEAPEST_ARC