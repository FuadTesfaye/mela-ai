import Shell from "@/components/Shell";
import DocsClient from "@/components/DocsClient";

export const metadata = {
  title: "Documentation & Developer Guide · MELA AI",
  description:
    "Comprehensive, simple, and convenient documentation for MELA AI: learner companion, Chrome extension, Web Components, and REST APIs.",
};

export default function Docs() {
  return (
    <Shell active="Help & resources" title="Documentation & resources">
      <DocsClient />
    </Shell>
  );
}
