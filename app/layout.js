import '../css/style.css';

export const metadata = {
  title: 'HEMA-Vision — Forensic AR Learning Platform',
  description:
    'Advanced AR platform for forensic bloodstain pattern analysis education. Combat misinformation with interactive 3D learning.',
  applicationName: 'HEMA-Vision',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HEMA-Vision',
  },
};

export const viewport = {
  themeColor: '#0A0E1A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
