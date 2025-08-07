// run close to users; keep provider key server-side
export const runtime = 'edge';

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const cluster = searchParams.get('cluster') || 'mainnet-beta';

  const upstream =
    cluster === 'devnet'
      ? process.env.SOLANA_RPC_DEVNET
      : process.env.SOLANA_RPC_MAINNET;

  if (!upstream) {
    return new Response(JSON.stringify({ error: 'rpc not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await req.text(); // raw passthrough
  const r = await fetch(upstream, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { 'content-type': 'application/json' },
  });
}

// be explicit: no GET
export async function GET() {
  return new Response('method not allowed', { status: 405 });
}
