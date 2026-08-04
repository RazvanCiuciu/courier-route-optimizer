import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 
    "postgres://vrptw:vrptw@localhost:5432/vrptw"
});