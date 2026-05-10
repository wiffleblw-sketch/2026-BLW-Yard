import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/auth — exchange password for edit cookie
// Body: { password: string }
// Sets a HTTP-only cookie if the password matches EDIT_PASSWORD env var.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const password = body?.password || '';

  const expected = process.env.EDIT_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: 'EDIT_PASSWORD not configured on server' },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'bad password' }, { status: 401 });
  }

  const token = process.env.EDIT_TOKEN || expected;
  const res = NextResponse.json({ ok: true });
  res.cookies.set('blw_edit', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

// DELETE /api/auth — sign out of edit mode
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('blw_edit', '', { maxAge: 0, path: '/' });
  return res;
}

// GET /api/auth — check current edit status
export async function GET(req) {
  const cookie = req.cookies.get('blw_edit')?.value;
  const token = process.env.EDIT_TOKEN || process.env.EDIT_PASSWORD;
  return NextResponse.json({ canEdit: cookie === token });
}
