import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { Pool } from "pg";
import path from "path";

// Database Setup
const isProd = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;

let db: any;
let pgPool: Pool | null = null;

if (isProd && databaseUrl) {
  // Use PostgreSQL for Production (Free on Supabase/Neon)
  pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  db = {
    exec: async (sql: string) => {
      const client = await pgPool!.connect();
      try { await client.query(sql); } finally { client.release(); }
    },
    all: async (sql: string, params: any[] = []) => {
      const res = await pgPool!.query(sql, params);
      return res.rows;
    },
    run: async (sql: string, params: any[] = []) => {
      const res = await pgPool!.query(sql, params);
      return { lastInsertRowid: res.rows[0]?.id };
    }
  };
} else {
  // Use SQLite for Local Development
  const sqlite = new Database("farming.db");
  db = {
    exec: (sql: string) => sqlite.exec(sql),
    all: (sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params),
    run: (sql: string, params: any[] = []) => sqlite.prepare(sql).run(...params)
  };
}

// Initialize database
const initDb = async () => {
  const sql = isProd && databaseUrl 
    ? `CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        type TEXT,
        data TEXT,
        result TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        data TEXT,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`;
  await db.exec(sql);
};

async function startServer() {
  await initDb();
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/records", async (req, res) => {
    try {
      const sql = "SELECT * FROM records ORDER BY timestamp DESC";
      const records = await db.all(sql);
      res.json(records.map((r: any) => ({ ...r, data: JSON.parse(r.data as string) })));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch records" });
    }
  });

  app.post("/api/records", async (req, res) => {
    try {
      const { type, data, result } = req.body;
      const sql = isProd && databaseUrl
        ? "INSERT INTO records (type, data, result) VALUES ($1, $2, $3) RETURNING id"
        : "INSERT INTO records (type, data, result) VALUES (?, ?, ?)";
      
      const info = await db.run(sql, [type, JSON.stringify(data), result]);
      res.json({ id: info.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: "Failed to save record" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`AgroTech Server running on http://localhost:${PORT}`);
  });
}

startServer();
