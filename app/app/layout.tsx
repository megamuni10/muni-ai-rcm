import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import { AuthWrapper } from "@/components/auth-wrapper";
import "@/lib/amplify-config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Muni Health RCM Platform",
  description: "AI-native Revenue Cycle Management platform for healthcare providers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthWrapper>
          {children}
        </AuthWrapper>
      </body>
    </html>
  );
}
