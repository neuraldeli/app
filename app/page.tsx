'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';

const ENDPOINT = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const;
type Cluster = keyof typeof ENDPOINT;

type Web3Mod = { Connection: any; PublicKey: any };

export default function PhantomBalance() {
  const [cluster, setCluster] = useState<Cluster>('mainnet-beta');
  const endpoint = useMemo(() => ENDPOINT[cluster], [cluster]);
  const [web3, setWeb3] = useState<Web3Mod | null>(null);
  const [conn, setConn] = useState<any | null>(null);
  const [pubkey, setPubkey] = useState<any | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const mod: any = await import('@solana/web3.js');
        if (!live) return;
        setWeb3({ Connection: mod.Connection, PublicKey: mod.PublicKey });
      } catch (e: any) { setErr(e?.message ?? String(e)); }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => { if (web3) setConn(new web3.Connection(endpoint, 'confirmed')); }, [web3, endpoint]);

  useEffect(() => {
    const p = (typeof window !== 'undefined') ? (window as any).solana : null;
    if (!p) return;
    p.on?.('connect', (pk: any) => setPubkey(pk));
    p.on?.('accountChanged', (pk: any|null) => setPubkey(pk));
    p.on?.('disconnect', () => { setPubkey(null); setBalance(null); });
    p.connect?.({ onlyIfTrusted: true }).catch(() => {});
    return () => { try { p.off?.('connect'); p.off?.('accountChanged'); } catch {} };
  }, []);

  const connect = async () => {
    setErr(null);
    try {
      const p = (window as any).solana;
      if (!p?.isPhantom) throw new Error('phantom not found');
      const res = await p.connect();
      setPubkey(res.publicKey);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  };
  const disconnect = async () => { try { await (window as any).solana?.disconnect(); } catch {}; setPubkey(null); setBalance(null); };

  const fetchBalance = useCallback(async () => {
    if (!conn || !pubkey) return;
    setLoading(true); setErr(null);
    try {
      const lamports = await conn.getBalance(pubkey, { commitment: 'confirmed' });
      setBalance(lamports / 1_000_000_000);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [conn, pubkey]);

  useEffect(() => { if (pubkey) fetchBalance(); }, [fetchBalance, pubkey]);

  const short = (s?: string, n=4) => s ? `${s.slice(0,n+2)}…${s.slice(-n)}` : '-';

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#e5e7eb'}}>
      <div style={{width:'100%',maxWidth:480,background:'#0b0b0f',border:'1px solid #27272a',borderRadius:12,padding:20}}>
        <h1 style={{fontSize:18,fontWeight:600,margin:0}}>phantom balance</h1>
        <p style={{fontSize:12,opacity:.7,marginTop:6}}>connect phantom and view sol balance.</p>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
          <button onClick={pubkey?disconnect:connect} style={{padding:'8px 12px',border:'1px solid #3f3f46',borderRadius:8,color: pubkey?'#fca5a5':'#34d399'}}>
            {pubkey ? 'disconnect' : 'connect phantom'}
          </button>
          <select value={cluster} onChange={(e)=>setCluster(e.target.value as Cluster)} style={{background:'transparent',border:'1px solid #3f3f46',borderRadius:8,color:'#e5e7eb',padding:'8px 12px'}}>
            <option value="mainnet-beta">mainnet-beta</option>
            <option value="devnet">devnet</option>
          </select>
        </div>

        <div style={{marginTop:12,padding:12,border:'1px solid #27272a',borderRadius:10}}>
          <div style={{fontSize:11,opacity:.7,textTransform:'uppercase',letterSpacing:.5}}>wallet</div>
          <div style={{marginTop:6}}>
            {typeof window==='undefined' ? 'server…' :
             pubkey ? short(pubkey.toBase58?.() ?? String(pubkey)) :
             ((window as any).solana?.isPhantom ? 'not connected' : 'phantom not detected')}
          </div>
        </div>

        <div style={{marginTop:12,padding:12,border:'1px solid #27272a',borderRadius:10}}>
          <div style={{fontSize:11,opacity:.7,textTransform:'uppercase',letterSpacing:.5}}>balance</div>
          <div style={{marginTop:6,fontSize:18}}>
            {balance==null ? (pubkey ? (loading?'…':'—') : '—') : balance.toFixed(6)} <span style={{fontSize:12,opacity:.7}}>sol</span>
          </div>
          <div style={{marginTop:8}}>
            <button onClick={fetchBalance} disabled={!pubkey || loading} style={{padding:'6px 10px',border:'1px solid #3f3f46',borderRadius:8,opacity:(!pubkey||loading)?0.5:1}}>refresh</button>
          </div>
          {err && <div style={{marginTop:8,fontSize:12,color:'#fca5a5'}}>error: {err}</div>}
        </div>
      </div>
    </div>
  );
}
