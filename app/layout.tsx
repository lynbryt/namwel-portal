import './globals.css';

export const metadata = {
  title: 'Namwel · Tourist Information Guide',
  description: 'Read and sign your Namwel pre-departure guide to Southern Africa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
