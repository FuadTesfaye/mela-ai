import Shell from "@/components/Shell";
import TutorPortal from "@/components/TutorPortal";
export default async function Ticket({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Shell active="Tutor workspace" title="Tutor workspace / Support request">
      <TutorPortal id={(await params).id} />
    </Shell>
  );
}
