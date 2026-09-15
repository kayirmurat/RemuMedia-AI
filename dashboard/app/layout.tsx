import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RemuMedia AI",
  description: "Video üretim panosu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-[960px] items-center justify-between px-5 py-4">
            <Link href="/" className="text-[15px] font-bold text-ink no-underline">
              RemuMedia AI
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/accounts" className="text-muted no-underline hover:text-ink">
                Bağlı Hesaplar
              </Link>
            </nav>
          </div>
        </header>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
