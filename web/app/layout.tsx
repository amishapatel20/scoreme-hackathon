import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workflow Operations Console",
  description: "Configurable workflow decisioning platform with operational telemetry and auditability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/assets/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
