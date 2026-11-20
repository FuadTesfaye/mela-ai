import { courseById } from "@/lib/courses/catalogue";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const course = courseById((await context.params).id);
  return Response.json(course || { error: "Course not found." }, {
    status: course ? 200 : 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": course ? "public, max-age=300" : "no-store",
    },
  });
}
