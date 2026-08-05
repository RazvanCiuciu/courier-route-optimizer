export type DeliveryDay = "thursday" | "friday";
export type OrderStatus = "pending" | "assigned" | "delivered" | "failed_attempt" | "dropped";
export type RouteStatus = "preview" | "committed";

export interface Client {
    readonly id: number;
    readonly name: string;
    readonly address: string;
    readonly phone_number: string;    
    readonly lat: number | null;        
    readonly lon: number | null;
}

export interface TimeWindow {
    readonly id: number;
    readonly order_id: number;
    readonly day: DeliveryDay;
    readonly start_time: string;      
    readonly end_time: string;
}

export interface Order {
    readonly id: number;
    readonly client_id: number;
    readonly assigned_day: DeliveryDay | null;   
    readonly delivery_week: string;
    readonly status: OrderStatus;
    readonly drop_reason: string | null;
    readonly total_amount: string;      // NUMERIC → string din pg, ca să nu piardă precizie
    readonly paid_cash: string;
    readonly paid_transfer: string;
}

export interface Route {
    readonly id: number;
    readonly delivery_week: string;
    readonly day: DeliveryDay;
    readonly vehicle_index: number;
    readonly total_time_min: number | null;
    readonly status: RouteStatus;
    readonly generated_at: Date;
}

export interface RouteStop {
    readonly id: number;
    readonly route_id: number;
    readonly order_id: number;
    readonly sequence: number;
    readonly eta_min: number | null;
    readonly chosen_window_id: number | null;
}

export interface NewTimeWindow {
    readonly day: DeliveryDay;
    readonly start_time: string;
    readonly end_time: string;
}

export interface NewOrder {
    readonly client_id: number;
    readonly delivery_week: string;     
    readonly time_windows: readonly NewTimeWindow[];
    readonly total_amount: string;
}

export interface NewClient {
    readonly name: string;
    readonly address: string;
    readonly phone_number: string;
}