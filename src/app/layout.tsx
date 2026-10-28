import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Toaster, GlobalDropZone } from "@/components/AppHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "DrosoSim Next — Simulateur de protection des vergers contre Drosophila suzukii", template: "%s — DrosoSim Next" },
  description: "Simulateur pédagogique d'aide à la décision : dessinez votre verger de cerisiers, combinez filets, prophylaxie, traitements, parasitoïdes et TIS, comparez les stratégies au témoin sur 1 à 3 ans (récolte saine, bilan économique, IFT).",
  applicationName: "DrosoSim Next",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <GlobalDropZone />
      </body>
    </html>
  );
}