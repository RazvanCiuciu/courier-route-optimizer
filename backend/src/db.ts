import pg,{ Pool } from "pg";

pg.types.setTypeParser(1082, (val) => val);
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 
    "postgres://vrptw:vrptw@localhost:5432/vrptw"
});