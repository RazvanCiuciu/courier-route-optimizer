import express from "express";
import {pool} from "./db"

const app = express();

app.use(express.json())

const port = Number(process.env.PORT) || 3000;

app.get("/health",(req, res) => {
  res.json({ status: "ok" })
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

app.get("/health/db", async (_req, res) => {

  try{
      const result = await pool.query(`SELECT 1`);
      if(result === null) 
        throw("500");
      res.json({status: "ok", db: "connected"});
  }
  catch(err){
      res.status(500).json({ error: "database unavailable" });
  }

});