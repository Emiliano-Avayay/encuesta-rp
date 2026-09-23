import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encuesta de Satisfacción | Poleas RP",
  description: "Encuesta de satisfacción del cliente de Poleas RP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
