import './globals.css'

export const metadata = {
  title: 'DMARC Report Visualizer',
  description: 'Analyze your DMARC XML reports client-side',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
