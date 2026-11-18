import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ÓRBITA — Juego Diario de Pensamiento Divergente',
  description:
    'Construye una constelación de 5 conceptos alrededor del Astro Central maximizando la distancia semántica entre tus ideas. Basado en el Divergent Association Task de Harvard.',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'ÓRBITA — Ritual Diario de Pensamiento Divergente',
    description:
      'Un observatorio visual y sonoro donde tu creatividad bisociativa se mide en tiempo real.',
    type: 'website',
    locale: 'es_ES',
  },
};

export const viewport: Viewport = {
  themeColor: '#040508',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-obsidian-950 text-ivory-100 antialiased selection:bg-astrolabe-400/30 selection:text-ivory-50">
        {children}
      </body>
    </html>
  );
}
