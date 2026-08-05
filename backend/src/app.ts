import express from "express";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errors";
import healthRoutes from "./routes/health.routes";
import ordersRoutes from "./routes/orders.routes";
import clientsRoutes from "./routes/clients.routes";
import { ZodError } from "zod";

const app = express();

app.use(express.json());
app.use("/health", healthRoutes);
app.use("/orders", ordersRoutes);
app.use("/clients", clientsRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
        res.status(400).json({ error: "Validation failed", details: err.issues });
        return;
    }
    if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});

export default app;