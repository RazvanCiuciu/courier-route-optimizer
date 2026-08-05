import { Router } from "express";
import * as clientsController from "../controllers/clients.controller";

const router = Router();

router.post("/", clientsController.create);
router.get("/", clientsController.listAll);
router.get("/:id", clientsController.getById);

export default router;