import type { Metadata } from "next";
import "./globals.css";
import "./action-plans.css";

export const metadata: Metadata = {
  title: "Encuesta de Satisfacción | RP Poleas",
  description: "Encuesta de satisfacción del cliente de RP Poleas"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
