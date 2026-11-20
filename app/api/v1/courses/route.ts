import { courses } from "@/lib/courses/catalogue";
export function GET() {
  return Response.json(
    {
      courses: courses.map(({ sections, resources, practice, ...course }) => ({
        ...course,
        sectionCount: sections.length,
      })),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
