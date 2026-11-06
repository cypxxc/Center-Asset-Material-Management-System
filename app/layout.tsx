import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-ibm-plex-sans-thai",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CAMMS Portal — เขตสุขภาพที่ 7",
    template: "%s | CAMMS Portal",
  },
  description: "CAMMS Portal — ระบบบริหารจัดการพัสดุและสินทรัพย์ส่วนกลาง เขตสุขภาพที่ 7 กระทรวงสาธารณสุข",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
      className={`${ibmPlexSansThai.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
