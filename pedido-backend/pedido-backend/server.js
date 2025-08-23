// server.js
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;

// Vars de conexión (en K8s vienen de ConfigMap/Secret; en local puedes exportarlas)
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = parseInt(process.env.DB_PORT || "5432", 10);
const DB_NAME = process.env.DB_NAME || "pedidos";
const DB_USER = process.env.DB_USER || "pedido";
const DB_PASSWORD = process.env.DB_PASSWORD || "pedido";

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
});

// Crear tabla si no existe
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  console.log("Tabla 'users' OK");
}

app.use(express.json());

// Healthchecks
app.get("/health", (_, res) => res.status(200).send("ok"));
app.get("/ready", async (_, res) => {
  try { await pool.query("SELECT 1;"); res.status(200).send("ready"); }
  catch { res.status(500).send("not-ready"); }
});

// ===== Endpoints SIN prefijo (/users) =====
app.post("/users", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name requerido" });
    const { rows } = await pool.query(
      "INSERT INTO users (name) VALUES ($1) RETURNING id, name;",
      [name]
    );
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: "db_error" }); }
});

app.get("/users", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM users ORDER BY id DESC;");
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: "db_error" }); }
});

// ===== Endpoints CON prefijo (/api/users) =====
// (para que funcione aunque el Ingress no reescriba /api)
app.post("/api/users", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name requerido" });
    const { rows } = await pool.query(
      "INSERT INTO users (name) VALUES ($1) RETURNING id, name;",
      [name]
    );
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: "db_error" }); }
});

app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM users ORDER BY id DESC;");
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: "db_error" }); }
});

// Arranque
app.listen(PORT, async () => {
  try { await ensureSchema(); } catch (e) { console.error("Init DB:", e); }
  console.log(`Backend listo en puerto ${PORT} — DB=${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
});
