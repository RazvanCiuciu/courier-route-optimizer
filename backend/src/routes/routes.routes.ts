import { Router } from "express";
import * as routesController from "../controllers/routes.controller";

const router = Router();
router.post("/preview", routesController.preview);
router.post("/commit", routesController.commit);
export default router;