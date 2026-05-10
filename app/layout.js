import './globals.css';

export const metadata = {
  title: 'BLW Yard · Big League Wiffleball',
  description: 'Live scoreboard, stats, and box scores for Big League Wiffleball.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
