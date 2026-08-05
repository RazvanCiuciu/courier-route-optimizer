import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const amountRegex = /^\d+(\.\d{1,2})?$/;

export const newClientSchema = z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    phone_number: z.string().min(1, "Phone number is required"),
});

export const newTimeWindowSchema = z.object({
    day: z.enum(["thursday", "friday"]),
    start_time: z.string().regex(timeRegex, "Invalid time format (HH:MM:SS)"),
    end_time: z.string().regex(timeRegex, "Invalid time format (HH:MM:SS)"),
});

export const newOrderSchema = z.object({
    client_id: z.number().int().positive(),
    delivery_week: z.string().regex(dateRegex, "Expected YYYY-MM-DD"),
    total_amount: z.string().regex(amountRegex, "Invalid amount"),
    time_windows: z.array(newTimeWindowSchema).min(1, "At least one time window required"),
});

export const changeStatusSchema = z.object({
    status: z.enum(["pending", "assigned", "delivered", "failed_attempt", "dropped"]),
    drop_reason: z.string().nullable().optional(),
});

export const assignDaySchema = z.object({
    day: z.enum(["thursday", "friday"]),
});

export const paymentSchema = z.object({
    paid_cash: z.string().regex(amountRegex, "Invalid amount"),
    paid_transfer: z.string().regex(amountRegex, "Invalid amount"),
});

export const stopUpdateSchema = z.object({
    status: z.enum(["delivered", "failed_attempt"]),
    paid_cash: z.string().regex(amountRegex, "Invalid amount").optional(),
    paid_transfer: z.string().regex(amountRegex, "Invalid amount").optional(),
    drop_reason: z.string().nullable().optional(),
});