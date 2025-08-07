'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';

export default function PhantomBalance() {
  // cluster toggle (still works w/ proxy)
  const rpcUrl = useMemo(() => {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/api/rpc?cluster=${cluster}`;
  }, [cluster]);
 
  // lazy-load web3 on client
  const [web3, setWeb3] = useState(null);
  const [conn, setConn] = useState(null);

  // wallet + ui
  const [pubkey, setPubkey] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // load @solana/web3.js client-side only
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const mod = await import('@solana/web3.js');
        if (!live) return;
        setWeb3({ Connection: mod.Connection, PublicKey: mod.PublicKey });
      } catch (e) {
        setErr(String(e?.message || e));
      }
    })();
    return () => { live = false; };
  }, []);

  // make a connection that POSTS to our proxy route (no cors, hides key)
  useEffect(() => {
  if (!web3) return;
  try {
    setConn(
      new web3.Connection(rpcUrl, {
        commitment: 'confirmed',
        fetch: (_url, opts) =>
          fetch(rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: opts?.body,
          }),
      })
    );
  } catch (e) {
    setErr(String(e?.message || e));
  }
}, [web3, rpcUrl]);


  // phantom provider + session adoption
  useEffect(() => {
    const p = typeof window !== 'undefined' ? window.solana : null;
    if (!p) return;
    p.on?.('connect', (pk) => setPubkey(pk));
    p.on?.('accountChanged', (pk) => setPubkey(pk));
    p.on?.('disconnect', () => { setPubkey(null); setBalance(null); });
    p.connect?.({ onlyIfTrusted: true }).catch(() => {});
    return () => { try { p.off?.('connect'); p.off?.('accountChanged'); } catch {} };
  }, []);

  const connect = async () => {
    setErr(null);
    try {
      const p = window.solana;
      if (!p?.isPhantom) throw new Error('phantom not found (open inside phantom app browser)');
      const res = await p.connect();
      setPubkey(res.publicKey);
    } catch (e) { setErr(String(e?.message || e)); }
  };

  const disconnect = async () => {
    try { await window.solana?.disconnect(); } catch {}
    setPubkey(null); setBalance(null);
  };

  const fetchBalance = useCallback(async () => {
    if (!conn || !pubkey) return;
    setLoading(true); setErr(null);
    try {
      const lamports = await conn.getBalance(pubkey, { commitment: 'confirmed' });
      setBalance(lamports / 1_000_000_000);
    } catch (e) {
      const m = String(e?.message || e);
      setErr(m.includes('403') ? 'rpc blocked — check proxy/env' : m);
    } finally {
      setLoading(false);
    }
  }, [conn, pubkey]);

  useEffect(() => { if (pubkey) fetchBalance(); }, [fetchBalance, pubkey]);

  const short = (s, n = 4) => s ? `${s.slice(0, n + 2)}…${s.slice(-n)}` : '-';

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#e5e7eb',background:'black'}}>
      <div style={{width:'100%',maxWidth:480,background:'#0b0b0f',border:'1px solid #27272a',borderRadius:12,padding:20}}>
        <h1 style={{fontSize:18,fontWeight:600,margin:0}}>phantom balance</h1>
        <p style={{fontSize:12,opacity:.7,marginTop:6}}>connect phantom and view sol balance via server proxy.</p>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
          <button onClick={pubkey ? disconnect : connect}
                  style={{padding:'8px 12px',border:'1px solid #3f3f46',borderRadius:8,color: pubkey?'#fca5a5':'#34d399'}}>
            {pubkey ? 'disconnect' : 'connect phantom'}
          </button>
          <select value={cluster} onChange={(e)=>setCluster(e.target.value)}
                  style={{background:'transparent',border:'1px solid #3f3f46',borderRadius:8,color:'#e5e7eb',padding:'8px 12px'}}>
            <option value="mainnet-beta">mainnet-beta</option>
            <option value="devnet">devnet</option>
          </select>
        </div>

        <div style={{marginTop:12,padding:12,border:'1px solid #27272a',borderRadius:10}}>
          <div style={{fontSize:11,opacity:.7,textTransform:'uppercase',letterSpacing:.5}}>wallet</div>
          <div style={{marginTop:6}}>
            {typeof window==='undefined' ? 'server…' :
             pubkey ? short(pubkey.toBase58?.() ?? String(pubkey)) :
             (window.solana?.isPhantom ? 'not connected' : 'phantom not detected (open inside phantom app)')}
          </div>
        </div>

        <div style={{marginTop:12,padding:12,border:'1px solid #27272a',borderRadius:10}}>
          <div style={{fontSize:11,opacity:.7,textTransform:'uppercase',letterSpacing:.5}}>balance</div>
          <div style={{marginTop:6,fontSize:18}}>
            {balance==null ? (pubkey ? (loading?'…':'—') : '—') : balance.toFixed(6)} <span style={{fontSize:12,opacity:.7}}>sol</span>
          </div>
          <div style={{marginTop:8,display:'flex',gap:8}}>
            <button onClick={fetchBalance} disabled={!pubkey || loading}
                    style={{padding:'6px 10px',border:'1px solid #3f3f46',borderRadius:8,opacity:(!pubkey||loading)?0.5:1}}>refresh</button>
          </div>
          {err && <div style={{marginTop:8,fontSize:12,color:'#fca5a5'}}>error: {err}</div>}
        </div>
      </div>
    </div>
  );
}
