import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Student identity: name-only, no password. A student "logs in" by picking a
// name; the client keeps the returned id in localStorage to come back later.
export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull(), // normalized (trim+lowercase) for lookup
  createdAt: integer("created_at").notNull(),
});

// One submission per (student, lesson) — resubmitting updates the same row.
export const submissions = sqliteTable(
  "submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id").notNull(),
    lessonSlug: text("lesson_slug").notNull(),
    lessonTitle: text("lesson_title").notNull(),
    phaseNumber: integer("phase_number").notNull(),
    code: text("code").notNull(),
    notes: text("notes").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    studentLessonIdx: uniqueIndex("submissions_student_lesson_idx").on(t.studentId, t.lessonSlug),
  })
);
