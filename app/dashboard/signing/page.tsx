import Shell from "@/components/Shell";
import SigningStudio from "@/components/SigningStudio";
export default function Page() {
  return (
    <Shell active="Tutor workspace" title="EthSL signing studio">
      <h1>Ethiopian Sign Language studio</h1>
      <p>
        Record, review, and publish human interpretations for a specific course
        video.
      </p>
      <SigningStudio />
    </Shell>
  );
}
