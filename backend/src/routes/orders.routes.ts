import { Router } from "express";
import * as ordersController from "../controllers/orders.controller";

const router = Router();

router.post("/", ordersController.create);
router.get("/", ordersController.listByWeek);
router.get("/:id", ordersController.getById);
router.patch("/:id/status", ordersController.changeStatus);
router.patch("/:id/day", ordersController.assignDay);
router.patch("/:id/payment", ordersController.recordPayment);
router.patch("/:id/reschedule", ordersController.reschedule);

export default router;