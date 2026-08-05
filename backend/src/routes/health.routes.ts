import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok" })
});

router.get("/db", async (_req, res) => {
    try{
        const result = await pool.query(`SELECT 1`);
        res.json({status: "ok", db: "connected"});
    }
    catch(err){
        res.status(500).json({ error: "database unavailable" });
    }
});

export default router;