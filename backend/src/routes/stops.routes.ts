import { Router } from "express";
import * as stopsController from "../controllers/stops.controller";

const router = Router();
router.patch("/:id", stopsController.updateStop);
export default router;