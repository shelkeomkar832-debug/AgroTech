import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("farming.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'soil' or 'health'
    data TEXT, -- JSON string of inputs
    result TEXT, -- AI response
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/records", (req, res) => {
    const records = db.prepare("SELECT * FROM records ORDER BY timestamp DESC").all();
    res.json(records.map(r => ({ ...r, data: JSON.parse(r.data as string) })));
  });

  app.post("/api/records", (req, res) => {
    const { type, data, result } = req.body;
    const info = db.prepare("INSERT INTO records (type, data, result) VALUES (?, ?, ?)").run(
      type,
      JSON.stringify(data),
      result
    );
    res.json({ id: info.lastInsertRowid });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AgroTech Server running on http://localhost:${PORT}`);
  });
}

startServer();
