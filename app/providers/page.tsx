"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AudioLines, CheckCircle2, CircleDollarSign, ExternalLink, Gauge, ShieldCheck } from "lucide-react";

type Provider = {
  id: string; name: string; tier: "free-self-hosted" | "free-limited" | "paid";
  deployment: string; capabilities: string[]; configured: boolean; website: string; notes: string; status: string;
};
const tierLabels = {
  "free-self-hosted": "Besplatno uz vlastito hostanje",
  "free-limited": "Besplatna kvota / ograničeni probni pristup",
  paid: "Plaćeni API"
};
export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [note, setNote] = useState("Učitavam katalog…");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    fetch("/api/providers", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error("Ne mogu učitati katalog.");
      const data = await res.json();
      setProviders(data.providers ?? []);
      setNote(data.note ?? "Katalog je učitan.");
    }).catch(() => setNote("Katalog trenutačno nije dostupan."));
  }, []);
  const visible = providers.filter((p) => filter === "all" || p.tier === filter);
  return <main style={{minHeight:"100vh",background:"#0c0d12",color:"#f5f5f7",padding:"28px 20px"}}>
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      <Link href="/" style={{display:"inline-flex",alignItems:"center",gap:8,color:"#c8c6ff",textDecoration:"none",marginBottom:24}}><ArrowLeft size={16}/> Povratak u Studio</Link>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}><AudioLines size={26}/><span style={{letterSpacing:3,fontWeight:800}}>CRO-MIX · PROVIDERS</span></div>
      <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"12px 0"}}>AI servisni katalog</h1>
      <p style={{maxWidth:760,color:"#a6a7b3",lineHeight:1.7}}>Prvo besplatni modeli koje možemo sami hostati, zatim ograničeni besplatni API-ji i profesionalni plaćeni servisi. Katalog ne znači da je provider već spojen za generiranje.</p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"24px 0"}}>
        {[["all","Svi servisi"],["free-self-hosted","Besplatni / self-hosted"],["free-limited","Free API kvote"],["paid","Plaćeni API"]].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} style={{border:"1px solid "+(filter===id?"#a49bff":"#30313b"),background:filter===id?"#292542":"#15161d",color:"#f5f5f7",borderRadius:999,padding:"10px 15px",cursor:"pointer"}}>{label}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:14}}>
        {visible.map((p)=><article key={p.id} style={{background:"#15161d",border:"1px solid #292a35",borderRadius:18,padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
            <div><h2 style={{fontSize:19,margin:"0 0 8px"}}>{p.name}</h2><span style={{fontSize:12,color:"#c4c2d6",background:"#272733",padding:"5px 8px",borderRadius:8}}>{tierLabels[p.tier]}</span></div>
            {p.configured ? <CheckCircle2 color="#66d9a8" size={20}/> : <CircleDollarSign color="#a49bff" size={20}/>}
          </div>
          <p style={{color:"#b5b6c2",fontSize:14,lineHeight:1.65,margin:0}}>{p.notes}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{p.capabilities.map((cap)=><span key={cap} style={{fontSize:11,border:"1px solid #353642",color:"#d2d0e0",padding:"4px 7px",borderRadius:7}}>{cap}</span>)}</div>
          <div style={{marginTop:"auto",paddingTop:6,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:p.configured?"#66d9a8":"#9b9cab"}}>{p.configured?"API ključ je postavljen":"Nije konfigurirano"}</span>
            <a href={p.website} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,color:"#c8c6ff",fontSize:13,textDecoration:"none"}}>Dokumentacija <ExternalLink size={14}/></a>
          </div>
        </article>)}
      </div>
      <section style={{marginTop:24,padding:20,border:"1px solid #514b79",background:"#191725",borderRadius:16}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}><ShieldCheck size={21}/><h2 style={{fontSize:18,margin:0}}>Sigurnosna napomena</h2></div>
        <p style={{color:"#c2c0cf",lineHeight:1.7,marginBottom:0}}>Ključevi se smiju postavljati samo u Vercel Environment Variables, nikad u browseru ili GitHub kodu. Prije slanja audiozapisa vanjskom servisu provjerit ćemo dopuštenja, licencu, ograničenja datoteke i trošak. <b>Generiranje je trenutačno isključeno</b> dok stvarni adapter i spremanje rezultata ne budu testirani.</p>
      </section>
      <p style={{display:"flex",alignItems:"center",gap:8,color:"#8f909e",fontSize:12,marginTop:20}}><Gauge size={14}/> {note}</p>
      <p style={{marginTop:8}}><Link href="/docs/AI-PROVIDERS.md" style={{color:"#c8c6ff"}}>Tehnički plan i usporedba API-ja</Link></p>
    </div>
  </main>;
}
