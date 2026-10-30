import { NextResponse } from 'next/server'

export async function GET() {
  const securityTxt = [
    '# CAMMS Security & Vulnerability Disclosure Policy',
    '# Reference: RFC 9116',
    'Contact: mailto:security@camms.local',
    'Expires: 2027-12-31T23:59:59.000Z',
    'Preferred-Languages: th, en',
    'Canonical: https://camms.local/.well-known/security.txt',
    'Policy: https://camms.local/security-policy',
  ].join('\n')

  return new NextResponse(securityTxt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'max-age=86400, public',
    },
  })
}
