import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sCoreDream = localFont({
  src: [
    {
      path: "./fonts/SCDream4-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/SCDream5-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/SCDream6-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-score-dream",
});

export const metadata: Metadata = {
  title: "가드닝 커리어 랩 | 조경전문가 직업체험",
  description:
    "실제 학교 공간을 설계하고 미니 조경 작품까지 만드는 조경전문가 직업체험 웹앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={sCoreDream.variable}>
      <body>{children}</body>
    </html>
  );
}
