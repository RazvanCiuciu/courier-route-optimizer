import { Router } from "express";
import * as routesController from "../controllers/routes.controller";


const router = Router();
router.post("/preview", routesController.preview);
router.post("/commit", routesController.commit);
router.get("/day", routesController.dayStops);
router.post("/reroute", routesController.reroute);
router.get("/compare", routesController.compare);
export default router;