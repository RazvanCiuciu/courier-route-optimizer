import { Router } from "express";
import * as clientsController from "../controllers/clients.controller";

const router = Router();

router.post("/check-address", clientsController.checkAddress);
router.post("/", clientsController.create);
router.get("/", clientsController.listAll);
router.get("/:id", clientsController.getById);
router.post("/:id/geocode", clientsController.geocodeClient);
router.patch("/:id", clientsController.update);

export default router;