import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import { students, submissions } from "./schema";

// One module worker = the whole site. Students identify by name only (no
// password) — the client keeps the returned studentId in localStorage.
type Env = {
  WEBSITE_DB_URL: string;
  WEBSITE_DB_TOKEN: string;
};

const app = new Hono<{ Bindings: Env }>();

function db(env: Env) {
  return drizzle(
    async (sql, params, method) => {
      const resp = await fetch(env.WEBSITE_DB_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.WEBSITE_DB_TOKEN}`,
        },
        body: JSON.stringify({ sql, params, method }),
      });
      if (!resp.ok) {
        throw new Error(`database query failed: ${resp.status} ${await resp.text()}`);
      }
      const data = (await resp.json()) as { rows?: unknown[] };
      return {
        rows: (data.rows ?? []).map((row) =>
          Array.isArray(row) ? row : Object.values(row as Record<string, unknown>)
        ),
      };
    },
    { schema: { students, submissions } }
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Identify (or create) a student by name only.
app.post("/api/students", async (c) => {
  const body = await c.req.json<{ name?: string }>();
  const name = (body.name ?? "").trim().slice(0, 60);
  if (!name) {
    return c.json({ error: "name is required" }, 400);
  }
  const nameKey = normalizeName(name);
  const d = db(c.env);
  const existing = await d.select().from(students).where(eq(students.nameKey, nameKey)).limit(1).all();
  if (existing.length > 0) {
    return c.json({ student: existing[0] });
  }
  const now = Date.now();
  await d.insert(students).values({ name, nameKey, createdAt: now });
  const created = await d.select().from(students).where(eq(students.nameKey, nameKey)).limit(1).all();
  return c.json({ student: created[0] }, 201);
});

// Fetch a student's portfolio (their submissions).
app.get("/api/students/:id/submissions", async (c) => {
  const studentId = Number(c.req.param("id"));
  if (!Number.isInteger(studentId)) {
    return c.json({ error: "invalid student id" }, 400);
  }
  const rows = await db(c.env)
    .select()
    .from(submissions)
    .where(eq(submissions.studentId, studentId))
    .all();
  return c.json({ submissions: rows });
});

// Submit (or update) a project for one lesson.
app.post("/api/students/:id/submissions", async (c) => {
  const studentId = Number(c.req.param("id"));
  if (!Number.isInteger(studentId)) {
    return c.json({ error: "invalid student id" }, 400);
  }
  const body = await c.req.json<{
    lessonSlug?: string;
    lessonTitle?: string;
    phaseNumber?: number;
    code?: string;
    notes?: string;
  }>();
  const lessonSlug = (body.lessonSlug ?? "").trim();
  const lessonTitle = (body.lessonTitle ?? "").trim();
  const phaseNumber = Number(body.phaseNumber ?? 0);
  const code = (body.code ?? "").slice(0, 20000);
  const notes = (body.notes ?? "").slice(0, 4000);
  if (!lessonSlug || !lessonTitle || !code.trim()) {
    return c.json({ error: "lessonSlug, lessonTitle and code are required" }, 400);
  }
  const d = db(c.env);
  const now = Date.now();
  const existing = await d
    .select()
    .from(submissions)
    .where(and(eq(submissions.studentId, studentId), eq(submissions.lessonSlug, lessonSlug)))
    .limit(1)
    .all();
  if (existing.length > 0) {
    await d
      .update(submissions)
      .set({ code, notes, lessonTitle, phaseNumber, updatedAt: now })
      .where(and(eq(submissions.studentId, studentId), eq(submissions.lessonSlug, lessonSlug)));
  } else {
    await d.insert(submissions).values({
      studentId,
      lessonSlug,
      lessonTitle,
      phaseNumber,
      code,
      notes,
      createdAt: now,
      updatedAt: now,
    });
  }
  const saved = await d
    .select()
    .from(submissions)
    .where(and(eq(submissions.studentId, studentId), eq(submissions.lessonSlug, lessonSlug)))
    .limit(1)
    .all();
  return c.json({ submission: saved[0] }, 201);
});

export default app;
