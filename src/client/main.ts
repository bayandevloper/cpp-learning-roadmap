import { phases, type Lesson } from "./data";

interface Student {
  id: number;
  name: string;
}

interface Submission {
  id: number;
  studentId: number;
  lessonSlug: string;
  lessonTitle: string;
  phaseNumber: number;
  code: string;
  notes: string;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const STORAGE_KEY = "cpp_student_v1";

function loadStudent(): Student | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Student;
  } catch {
    return null;
  }
}

function saveStudent(s: Student): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function clearStudent(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const totalLessons = phases.reduce((sum, p) => sum + p.lessons.length, 0);

let currentStudent: Student | null = loadStudent();
let submissionsBySlug: Record<string, Submission> = {};
let currentRoute: "roadmap" | "portfolio" = "roadmap";

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return (await res.json()) as T;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return (await res.json()) as T;
}

async function loadSubmissions(): Promise<void> {
  if (!currentStudent) return;
  const data = await apiGet<{ submissions: Submission[] }>(
    `/api/students/${currentStudent.id}/submissions`
  );
  submissionsBySlug = {};
  for (const s of data.submissions) {
    submissionsBySlug[s.lessonSlug] = s;
  }
}

function renderIdentityGate(): void {
  app.innerHTML = `
    <div class="identity-gate">
      <h1>مرحبًا بك في خارطة تعلم C++</h1>
      <p>عرّف نفسك باسم فقط (بدون كلمة مرور) لتبدأ رحلتك وتحتفظ بملف أعمالك الخاص على هذا المتصفح.</p>
      <form class="identity-form" id="identity-form">
        <input type="text" id="name-input" placeholder="اسمك" maxlength="60" required />
        <button type="submit">ابدأ رحلتي</button>
      </form>
    </div>
  `;
  const form = document.querySelector<HTMLFormElement>("#identity-form")!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.querySelector<HTMLInputElement>("#name-input")!;
    const name = input.value.trim();
    if (!name) return;
    const data = await apiPost<{ student: Student }>("/api/students", { name });
    currentStudent = data.student;
    saveStudent(currentStudent);
    await loadSubmissions();
    render();
  });
}

function renderTopBar(): string {
  return `
    <div class="top-bar">
      <div>
        طالب: <strong>${escapeHtml(currentStudent!.name)}</strong>
      </div>
      <div class="top-nav-links">
        <a href="#roadmap" class="${currentRoute === "roadmap" ? "active" : ""}" data-route="roadmap">الخارطة</a>
        <a href="#portfolio" class="${currentRoute === "portfolio" ? "active" : ""}" data-route="portfolio">ملف أعمالي</a>
      </div>
      <button id="logout-btn">تسجيل خروج</button>
    </div>
  `;
}

function attachTopBarEvents(): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-route]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      currentRoute = el.dataset.route as "roadmap" | "portfolio";
      render();
    });
  });
  document.querySelector("#logout-btn")?.addEventListener("click", () => {
    clearStudent();
    currentStudent = null;
    submissionsBySlug = {};
    render();
  });
}

function lessonHtml(lesson: Lesson, phaseNumber: number, globalIndex: number): string {
  const submitted = submissionsBySlug[lesson.slug];
  const done = Boolean(submitted);
  const topicsHtml = lesson.topics.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  return `
    <div class="lesson" data-slug="${lesson.slug}">
      <button class="lesson-toggle" data-toggle="${lesson.slug}">
        <span class="lesson-num">${globalIndex}</span>
        <span class="lesson-title">${escapeHtml(lesson.title)}</span>
        ${done ? '<span class="done-badge">مكتمل ✓</span>' : ""}
        <span class="chevron">▾</span>
      </button>
      <div class="lesson-body">
        <p class="lesson-summary">${escapeHtml(lesson.summary)}</p>
        <div class="lesson-topics">
          <h4>ستتعلم في هذا الدرس:</h4>
          <ul>${topicsHtml}</ul>
        </div>
        <p class="lesson-full">${escapeHtml(lesson.fullContent)}</p>
        <div class="lesson-project">
          <h4>🎯 مشروع الدرس: ${escapeHtml(lesson.project.title)}</h4>
          <p>${escapeHtml(lesson.project.description)}</p>
          <p class="deliverable"><strong>المطلوب لملف أعمالك:</strong> ${escapeHtml(lesson.project.deliverable)}</p>
        </div>
        <div class="submit-form">
          <label>كود C++ الخاص بمشروعك</label>
          <textarea class="code-input" rows="8" placeholder="#include <iostream>&#10;using namespace std;&#10;&#10;int main() {&#10;    // اكتب كودك هنا&#10;}">${escapeHtml(submitted?.code ?? "")}</textarea>
          <label>ملاحظات / شرح قصير (اختياري)</label>
          <textarea class="notes-input notes" rows="3" placeholder="اكتب شرحًا موجزًا لطريقة عمل الكود">${escapeHtml(submitted?.notes ?? "")}</textarea>
          <button class="submit-btn" data-phase="${phaseNumber}" data-slug="${lesson.slug}" data-title="${escapeHtml(lesson.title)}">
            ${done ? "تحديث المشروع في ملف أعمالي" : "حفظ في ملف أعمالي"}
          </button>
          <div class="submit-status" data-status="${lesson.slug}"></div>
        </div>
      </div>
    </div>
  `;
}

function renderRoadmap(): void {
  const completedCount = Object.keys(submissionsBySlug).length;
  const pct = Math.round((completedCount / totalLessons) * 100);

  let globalIndex = 0;
  const phasesHtml = phases
    .map((phase) => {
      const doneInPhase = phase.lessons.filter((l) => submissionsBySlug[l.slug]).length;
      const phasePct = Math.round((doneInPhase / phase.lessons.length) * 100);
      const lessonsHtml = phase.lessons
        .map((lesson) => {
          globalIndex += 1;
          return lessonHtml(lesson, phase.number, globalIndex);
        })
        .join("");
      return `
        <div class="phase" id="phase-${phase.number}">
          <div class="phase-header">
            <div class="phase-badge">${phase.number}</div>
            <div class="phase-header-text">
              <h2>${escapeHtml(phase.title)}</h2>
              <p class="phase-intro">${escapeHtml(phase.intro)}</p>
              <div class="phase-progress-bar"><div class="phase-progress-fill" style="width:${phasePct}%"></div></div>
              <span class="phase-progress-label">${doneInPhase} / ${phase.lessons.length} دروس مكتملة</span>
            </div>
          </div>
          <div class="lessons">${lessonsHtml}</div>
        </div>
      `;
    })
    .join("");

  const navHtml = phases
    .map((p) => `<a href="#phase-${p.number}"><span class="nav-num">${p.number}</span>${escapeHtml(p.title)}</a>`)
    .join("");

  app.innerHTML = `
    ${renderTopBar()}
    <div class="hero">
      <div class="hero-inner">
        <div class="eyebrow">تعلم بالمشاريع</div>
        <h1>خارطة تعلم C++ — 36 درسًا، 36 مشروعًا</h1>
        <p class="hero-sub">كل درس مرتبط بمشروع عملي صغير خاص به. أنجز المشروع، احفظه، ويصبح جزءًا من ملف أعمالك الشخصي.</p>
        <div class="hero-stats">
          <div class="stat"><strong>${totalLessons}</strong><span>درس</span></div>
          <div class="stat"><strong>${phases.length}</strong><span>مراحل</span></div>
          <div class="stat"><strong>${completedCount}</strong><span>أنجزتها</span></div>
        </div>
        <div class="overall-progress">
          <div class="overall-progress-bar"><div class="overall-progress-fill" style="width:${pct}%"></div></div>
          <div class="overall-progress-label">${pct}% من الخارطة مكتمل</div>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="intro-block">
        <h2>كيف تعمل هذه الخارطة؟</h2>
        <p>افتح كل درس، اقرأ شرحه، ثم نفّذ مشروعه العملي واكتب كودك في الصندوق أسفل الدرس واحفظه. سيظهر تقدمك تلقائيًا، وستجد كل مشاريعك مجمّعة في صفحة «ملف أعمالي».</p>
      </div>
      <div class="roadmap-nav">${navHtml}</div>
      ${phasesHtml}
    </div>
    <div class="site-footer">محتوى الدروس مبني بالاستناد إلى مرجع C++ العربي في موقع هرمش، معاد صياغته وربطه بمشاريع عملية.</div>
  `;

  attachTopBarEvents();

  document.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".lesson")?.classList.toggle("open");
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".submit-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const slug = btn.dataset.slug!;
      const title = btn.dataset.title!;
      const phaseNumber = Number(btn.dataset.phase);
      const lessonEl = btn.closest(".lesson")!;
      const code = lessonEl.querySelector<HTMLTextAreaElement>(".code-input")!.value.trim();
      const notes = lessonEl.querySelector<HTMLTextAreaElement>(".notes-input")!.value.trim();
      const statusEl = document.querySelector<HTMLDivElement>(`[data-status="${slug}"]`)!;
      if (!code) {
        statusEl.textContent = "أضف كودك أولاً قبل الحفظ.";
        statusEl.style.color = "#f87171";
        return;
      }
      statusEl.textContent = "جارٍ الحفظ...";
      statusEl.style.color = "";
      try {
        const data = await apiPost<{ submission: Submission }>(
          `/api/students/${currentStudent!.id}/submissions`,
          { lessonSlug: slug, lessonTitle: title, phaseNumber, code, notes }
        );
        submissionsBySlug[slug] = data.submission;
        statusEl.textContent = "تم الحفظ في ملف أعمالك ✓";
        statusEl.style.color = "var(--accent-2)";
        render();
        location.hash = `phase-${phaseNumber}`;
      } catch {
        statusEl.textContent = "حدث خطأ أثناء الحفظ، حاول مرة أخرى.";
        statusEl.style.color = "#f87171";
      }
    });
  });
}

function renderPortfolio(): void {
  const items = Object.values(submissionsBySlug).sort((a, b) => a.phaseNumber - b.phaseNumber);
  const itemsHtml = items.length
    ? items
        .map(
          (s) => `
      <div class="portfolio-item">
        <h3>${escapeHtml(s.lessonTitle)}</h3>
        <pre>${escapeHtml(s.code)}</pre>
        ${s.notes ? `<p class="notes-text">${escapeHtml(s.notes)}</p>` : ""}
      </div>
    `
        )
        .join("")
    : `<div class="empty-portfolio">لم تُنجز أي مشروع بعد. ابدأ من «الخارطة» ونفّذ مشروع أول درس.</div>`;

  const completedCount = items.length;
  const pct = Math.round((completedCount / totalLessons) * 100);

  app.innerHTML = `
    ${renderTopBar()}
    <div class="container">
      <div class="portfolio-header">
        <h1>ملف أعمال ${escapeHtml(currentStudent!.name)}</h1>
        <div class="overall-progress">
          <div class="overall-progress-bar"><div class="overall-progress-fill" style="width:${pct}%"></div></div>
          <div class="overall-progress-label">${completedCount} / ${totalLessons} مشروعًا مكتملًا</div>
        </div>
      </div>
      ${itemsHtml}
    </div>
    <div class="site-footer">ملف أعمالك محفوظ باسمك فقط — عد لهذا المتصفح بأي وقت لمواصلة رحلتك.</div>
  `;
  attachTopBarEvents();
}

function render(): void {
  if (!currentStudent) {
    renderIdentityGate();
    return;
  }
  if (currentRoute === "portfolio") {
    renderPortfolio();
  } else {
    renderRoadmap();
  }
}

async function init(): Promise<void> {
  if (currentStudent) {
    try {
      await loadSubmissions();
    } catch {
      // ignore — render with whatever we have
    }
  }
  render();
}

void init();
