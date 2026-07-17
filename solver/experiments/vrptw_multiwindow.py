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
    data["num_vehicles"] = 4
    data["depot"] = 0
    return data

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

data = create_data_model()
new_matrix, expanded_windows, node_to_location, twin_groups = expand_locations(
    data["time_windows"], data["time_matrix"]
)

print("1. GRUPURILE DE GEMENI (twin_groups):")
for i, group in enumerate(twin_groups):
    print(f"Clientul original {i:2d}: {group}")
print("-" * 40)

print("\n2. FERESTRELE DE TIMP EXTINSE:")
for i, window in enumerate(expanded_windows):
    orig = node_to_location[i]
    print(f"Nod nou {i:2d} (Locația originală {orig}): {window}")
print("-" * 40)

print("\n3. MATRICEA DE TIMPI EXTINSĂ (12x12):")
total_nodes = len(node_to_location)
for i in range(total_nodes):
    row_str = " ".join(f"{val:2d}" for val in new_matrix[i])
    print(f"Nod {i:2d} (Orig {node_to_location[i]}): [ {row_str} ]")