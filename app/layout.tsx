import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Savanna · MELA Learning Support",
  description:
    "Your accessible, multilingual learning companion. Learn in your language, at your pace.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
