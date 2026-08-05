import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAMMS",
  description: "Center Asset Material Management System - ระบบทะเบียนครุภัณฑ์และวัสดุสำนักงาน",
  icons: {
    icon: [
      { url: "/boxes.png", type: "image/png" },
    ],
    shortcut: "/boxes.png",
    apple: "/boxes.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
