import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RemuMedia AI",
  description: "Video üretim panosu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
