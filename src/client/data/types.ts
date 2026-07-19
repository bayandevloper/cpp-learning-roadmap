export interface LessonProject {
  title: string;
  description: string;
  deliverable: string;
}

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  topics: string[];
  fullContent: string;
  project: LessonProject;
}

export interface Phase {
  number: number;
  title: string;
  intro: string;
  lessons: Lesson[];
}
