import * as ordersRepo from "../repositories/orders.repo";
import * as clientsRepo from "../repositories/clients.repo";
import type { OrderWithWindows } from "../repositories/orders.repo";
import type { NewOrder, Order, OrderStatus, DeliveryDay } from "../types/domain";
import { NotFoundError, ValidationError, ConflictError } from "../errors";


const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending:        ["assigned", "dropped"],
    assigned:       ["delivered", "failed_attempt", "dropped"],
    failed_attempt: ["assigned", "dropped"],      
    delivered:      [],                            
    dropped:        ["pending"],                  
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
}

export async function createOrder(data: NewOrder): Promise<OrderWithWindows> {
    const client = await clientsRepo.findById(data.client_id);
    if (client === null) {
        throw new NotFoundError("Client", data.client_id);
    }

    if (data.time_windows.length === 0) {
        throw new ValidationError("Order must have at least one time window");
    }

    for (const w of data.time_windows) {
        if (w.start_time >= w.end_time) {
            throw new ValidationError(
                `Invalid time window: ${w.start_time} is not before ${w.end_time}`
            );
        }
    }

    return ordersRepo.create(data);
}

export async function getOrderById(id: number): Promise<Order> {
    const order = await ordersRepo.findById(id);
    if (order === null) {
        throw new NotFoundError("Order", id);
    }
    return order;
}

export async function getOrdersForWeek(week: string): Promise<OrderWithWindows[]> {
    return ordersRepo.findByWeekWithWindows(week);
}

export async function changeStatus(
    id: number,
    newStatus: OrderStatus,
    dropReason: string | null = null
): Promise<Order> {
    const order = await getOrderById(id);         

    if (!canTransition(order.status, newStatus)) {
        throw new ConflictError(
            `Cannot transition from '${order.status}' to '${newStatus}'`
        );
    }

    const updated = await ordersRepo.updateStatus(id, newStatus, dropReason);
    return updated!;  
}

export async function assignToDay(id: number, day: DeliveryDay): Promise<Order> {
    const order = await getOrderById(id);

    if (!canTransition(order.status, "assigned")) {
        throw new ConflictError(
            `Cannot assign an order with status '${order.status}'`
        );
    }

    const updated = await ordersRepo.assignDay(id, day);
    return updated!;
}

export async function recordPayment(
    id: number,
    paidCash: string,
    paidTransfer: string
): Promise<Order> {
    const order = await getOrderById(id);

    const cash = Number(paidCash);
    const transfer = Number(paidTransfer);
    const total = Number(order.total_amount);

    if (cash < 0 || transfer < 0) {
        throw new ValidationError("Payment amounts cannot be negative");
    }
    if (cash + transfer > total) {
        throw new ValidationError(
            `Payment (${cash + transfer}) exceeds order total (${total})`
        );
    }

    const updated = await ordersRepo.recordPayment(id, paidCash, paidTransfer);
    return updated!;
}