import fs from "node:fs";
import path from "node:path";

import Script from "next/script";

function loadConsoleBodyHtml(): string {
  const htmlPath = path.join(process.cwd(), "ui", "index.html");
  const rawHtml = fs.readFileSync(htmlPath, "utf-8");

  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    throw new Error(`Unable to locate <body> in ${htmlPath}`);
  }

  // Remove the original script tag; Next loads it via <Script>.
  return bodyMatch[1].replace(/<script[^>]*src="\/assets\/app\.js"[^>]*><\/script>/gi, "");
}

export default function Home() {
  const bodyHtml = loadConsoleBodyHtml();

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Script src="/assets/app.js" strategy="afterInteractive" />
    </>
  );
}
