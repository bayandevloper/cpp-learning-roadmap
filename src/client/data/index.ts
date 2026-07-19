import type { Phase } from "./types";
export type { Phase, Lesson, LessonProject } from "./types";

import { phase1 } from "./phase1";
import { phase2 } from "./phase2";
import { phase3 } from "./phase3";
import { phase4 } from "./phase4";
import { phase5 } from "./phase5";
import { phase6 } from "./phase6";

export const phases: Phase[] = [
  phase1,
  phase2,
  phase3,
  phase4,
  phase5,
  phase6,
];
