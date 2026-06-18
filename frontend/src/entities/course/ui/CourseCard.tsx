import React from "react";
import Link from "next/link";
import { DirectionTag } from "@/shared/ui";
import { directionColor } from "@/shared/lib/direction";
import type { CourseSummary } from "../model/types";

/**
 * Game-styled catalogue card for the student portal: a tinted direction cover,
 * title, lesson/group counts and a direction tag. Colour comes only from the
 * direction (DESIGN_BRIEF §3).
 */
export function CourseCard({ course, href }: { course: CourseSummary; href: string }) {
  const color = directionColor(course.direction);
  return (
    <Link href={href} className="course-card">
      <div className="course-card-cover" style={{ backgroundColor: `${color}1f` }}>
        <span className="course-card-monogram" style={{ color }}>
          {course.title.slice(0, 1)}
        </span>
        <DirectionTag direction={course.direction} />
      </div>
      <div className="course-card-body">
        <div className="course-card-title">{course.title}</div>
        {course.description && <div className="course-card-desc">{course.description}</div>}
        <div className="course-card-meta">
          <span>{course.lessons_count} уроков</span>
          <span>·</span>
          <span>{course.groups_count} групп</span>
        </div>
      </div>
    </Link>
  );
}
