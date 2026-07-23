"use client";

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CookingPot,
  Flame,
  Grid2X2,
  History,
  LayoutDashboard,
  Minus,
  PackageOpen,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type View = "dashboard" | "kasir" | "produksi" | "stok" | "drawer" | "laporan" | "riwayat" | "pengaturan";
type Cut = "Dada" | "Paha atas" | "Paha bawah" | "Sayap";
type CartItem = { id: number; name: string; cut?: Cut; price: number; qty: number };

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const cutStock: Record<Cut, number> = { Dada: 6, "Paha atas": 4, "Paha bawah": 4, Sayap: 4 };

const menuItems = [
  { id: 1, name: "Ayam Crispy", note: "1 potong", price: 13000, icon: "🍗", color: "sun" },
  { id: 2, name: "Paket Ayam Nasi", note: "Ayam + nasi", price: 19000, icon: "🍱", color: "cream" },
  { id: 3, name: "Rice Bowl", note: "Ayam suwir", price: 16000, icon: "🥣", color: "orange" },
  { id: 4, name: "Paket Berdua", note: "2 ayam + 2 nasi", price: 36000, icon: "🍗", color: "red" },
  { id: 5, name: "Nasi Putih", note: "1 porsi", price: 5000, icon: "🍚", color: "cream" },
  { id: 6, name: "Air Mineral", note: "600 ml", price: 4000, icon: "💧", color: "blue" },
  { id: 7, name: "Saus Extra", note: "2 sachet", price: 2000, icon: "🌶️", color: "red" },
  { id: 8, name: "Kulit Crispy", note: "1 pouch", price: 9000, icon: "✨", color: "sun" },
];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><Flame size={22} strokeWidth={2.6} /></div>
      <div><strong>SABANA</strong><span>OPERATION HUB</span></div>
    </div>
  );
}

const nav = [
  { id: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { id: "kasir", label: "Kasir", icon: ShoppingBag },
  { id: "produksi", label: "Produksi", icon: CookingPot },
  { id: "stok", label: "Persediaan", icon: Boxes },
  { id: "drawer", label: "Kas & Shift", icon: WalletCards },
] as const;

const secondaryNav = [
  { id: "laporan", label: "Laporan", icon: BarChart3 },
  { id: "riwayat", label: "Riwayat aktivitas", icon: History },
  { id: "pengaturan", label: "Pengaturan", icon: Settings },
] as const;

function Sidebar({ view, setView }: { view: View; setView: (view: View) => void }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav>
        <span className="nav-caption">OPERASIONAL</span>
        {nav.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
            <item.icon size={19} /> {item.label}
            {item.id === "kasir" && <i>3</i>}
          </button>
        ))}
        <span className="nav-caption lower">LAINNYA</span>
        {secondaryNav.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
            <item.icon size={19} /> {item.label}
          </button>
        ))}
      </nav>
      <div className="shift-card">
        <div><span className="live-dot" /> SHIFT AKTIF</div>
        <strong>08:02 — sekarang</strong>
        <span>Drawer: Rp 726.000</span>
        <button onClick={() => setView("drawer")}>Lihat shift <ArrowRight size={15} /></button>
      </div>
      <div className="operator">
        <div className="avatar">DN</div>
        <div><strong>Dina</strong><span>Operator pagi</span></div>
        <ChevronDown size={17} />
      </div>
    </aside>
  );
}

function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="topbar">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="top-actions">
        <button className="icon-button"><Bell size={19} /><span /></button>
        <div className="date-chip"><Clock3 size={17} /><div><small>Kamis</small><strong>23 Juli 2026</strong></div></div>
      </div>
    </header>
  );
}

function Dashboard({ setView }: { setView: (view: View) => void }) {
  const [period, setPeriod] = useState("Hari ini");
  const [customPeriod, setCustomPeriod] = useState(false);
  return (
    <>
      <Topbar title="Selamat pagi, Dina" subtitle="Berikut kondisi outlet Sabana hari ini." />
      <main className="content dashboard-content">
        <section className="period-bar">
          <div>
            {["Hari ini","Kemarin","Minggu ini","Bulan ini","All time"].map(item=><button key={item} className={period===item?"active":""} onClick={()=>setPeriod(item)}>{item}</button>)}
          </div>
          <button className="custom-period" onClick={()=>setCustomPeriod(true)}><Clock3/> Periode khusus</button>
        </section>
        <section className="hero-strip">
          <div><span>OMZET · {period.toUpperCase()}</span><strong>Rp 2.480.000</strong><p><b>↑ 12,4%</b> dibanding periode sebelumnya</p></div>
          <div className="hero-divider" />
          <div className="hero-mini"><ReceiptText /><span>Transaksi<strong>86</strong></span></div>
          <div className="hero-mini"><CircleDollarSign /><span>Rata-rata<strong>Rp 28.837</strong></span></div>
          <div className="hero-mini"><ShoppingBag /><span>Ayam terjual<strong>124 pcs</strong></span></div>
        </section>

        <section className="quick-grid">
          <button onClick={() => setView("kasir")}><span className="quick-icon red"><Plus /></span><div><strong>Pesanan baru</strong><small>Mulai transaksi kasir</small></div><ArrowRight /></button>
          <button onClick={() => setView("produksi")}><span className="quick-icon amber"><Flame /></span><div><strong>Goreng 2 pak</strong><small>Tambah stok etalase</small></div><ArrowRight /></button>
          <button onClick={() => setView("drawer")}><span className="quick-icon green"><ArrowDownLeft /></span><div><strong>Catat kas</strong><small>Cash-in atau cash-out</small></div><ArrowRight /></button>
        </section>

        <section className="two-col">
          <div className="panel">
            <div className="panel-head"><div><h2>Stok etalase</h2><p>Diperbarui beberapa detik lalu</p></div><button onClick={() => setView("stok")}>Lihat detail</button></div>
            <div className="display-stock">
              {Object.entries(cutStock).map(([cut, stock]) => (
                <div key={cut}><span className="chicken-symbol">♨</span><p>{cut}</p><strong>{stock}</strong><small>potong</small><i className={stock <= 4 ? "low" : ""}>{stock <= 4 ? "Menipis" : "Tersedia"}</i></div>
              ))}
            </div>
          </div>
          <div className="panel fryer-panel">
            <div className="panel-head"><div><h2>Kondisi deep fryer</h2><p>Siklus minyak aktif</p></div><span className="status warning">Perlu diperiksa</span></div>
            <div className="fryer-main">
              <div className="gauge"><span>164</span><small>/200 pak</small></div>
              <div className="fryer-stats">
                <div><span>Umur minyak</span><strong>15 hari</strong><small>Maks. 21 hari</small></div>
                <div><span>Top-up</span><strong>6 / 10 pak</strong><small>4 pak lagi</small></div>
              </div>
            </div>
            <button className="outline-wide" onClick={() => setView("produksi")}>Periksa kondisi minyak <ArrowRight size={16} /></button>
          </div>
        </section>

        <section className="two-col bottom">
          <div className="panel">
            <div className="panel-head"><div><h2>Penjualan per jam</h2><p>Jumlah transaksi hari ini</p></div><button className="select-button">Hari ini <ChevronDown size={15} /></button></div>
            <div className="chart">
              {[25,38,28,55,47,75,63,89,58,70].map((v,i)=><div key={i} className={i===7 ? "hot":""} style={{height:`${v}%`}}><span>{i+8}:00</span></div>)}
            </div>
          </div>
          <div className="panel alerts">
            <div className="panel-head"><div><h2>Perlu perhatian</h2><p>3 hal membutuhkan tindakan</p></div></div>
            <div className="alert-row"><span className="alert-icon amber"><Flame /></span><div><strong>Minyak perlu diperiksa</strong><small>Sudah digunakan 164 pak · 15 hari</small></div><ArrowRight /></div>
            <div className="alert-row"><span className="alert-icon red"><PackageOpen /></span><div><strong>Stok sayap menipis</strong><small>Tersisa 4 potong di etalase</small></div><ArrowRight /></div>
            <div className="alert-row"><span className="alert-icon blue"><Boxes /></span><div><strong>Tepung hampir habis</strong><small>Tersisa 1,3 pak · cukup untuk 3 pak ayam</small></div><ArrowRight /></div>
          </div>
        </section>
        <section className="analytics-grid">
          <div className="panel">
            <div className="panel-head"><div><h2>Komposisi penjualan</h2><p>Kontribusi tiap kategori menu</p></div><button onClick={()=>setView("laporan")}>Analisa</button></div>
            <div className="donut-wrap"><div className="donut"><span>124<small>item</small></span></div><div className="legend"><p><i className="l-red"/>Paket ayam <b>46%</b></p><p><i className="l-amber"/>Ayam satuan <b>29%</b></p><p><i className="l-green"/>Rice bowl <b>16%</b></p><p><i className="l-gray"/>Lainnya <b>9%</b></p></div></div>
          </div>
          <div className="panel">
            <div className="panel-head"><div><h2>Metode pembayaran</h2><p>Nilai transaksi berdasarkan metode</p></div></div>
            <div className="horizontal-bars"><div><span>Tunai <b>Rp826rb</b></span><i><em style={{width:"34%"}}/></i></div><div><span>QRIS <b>Rp1,65jt</b></span><i><em className="qris-bar" style={{width:"66%"}}/></i></div></div>
          </div>
          <div className="panel">
            <div className="panel-head"><div><h2>Efisiensi produksi</h2><p>Hasil aktual terhadap standar</p></div></div>
            <div className="efficiency"><strong>98,7%</strong><span>178 dari 180 potong sesuai standar</span><div><i style={{width:"98.7%"}}/></div><small>Susut produksi: 2 potong</small></div>
          </div>
        </section>
      </main>
      {customPeriod && <Modal close={()=>setCustomPeriod(false)}>
        <div className="modal-head"><div><span className="modal-icon"><Clock3/></span><div><h2>Pilih periode khusus</h2><p>Analisa data pada rentang tanggal tertentu.</p></div></div><button onClick={()=>setCustomPeriod(false)}><X/></button></div>
        <div className="date-range"><label>Dari<input type="date" defaultValue="2026-07-01"/></label><span>→</span><label>Sampai<input type="date" defaultValue="2026-07-23"/></label></div>
        <button className="primary-wide" onClick={()=>{setPeriod("1–23 Jul 2026");setCustomPeriod(false)}}>Terapkan periode</button>
      </Modal>}
    </>
  );
}

function Modal({ children, close }: { children: React.ReactNode; close: () => void }) {
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}>{children}</div></div>;
}

function POS() {
  const [cart, setCart] = useState<CartItem[]>([
    { id: 101, name: "Paket Ayam Nasi", cut: "Dada", price: 19000, qty: 1 },
    { id: 102, name: "Ayam Crispy", cut: "Paha atas", price: 13000, qty: 1 },
  ]);
  const [cutPicker, setCutPicker] = useState<(typeof menuItems)[number] | null>(null);
  const [paid, setPaid] = useState(false);
  const [payment, setPayment] = useState(false);
  const [channel, setChannel] = useState("Takeaway");
  const [cash, setCash] = useState("");
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const addItem = (item: (typeof menuItems)[number], cut?: Cut) => {
    setCart((prev) => [...prev, { id: Date.now(), name: item.name, price: item.price, qty: 1, cut }]);
    setCutPicker(null);
  };
  const clickMenu = (item: (typeof menuItems)[number]) => {
    if ([1,2,4].includes(item.id)) setCutPicker(item); else addItem(item);
  };
  return (
    <>
      <div className="pos-topbar"><div><h1>Kasir</h1><p>{channel} · Pesanan #A-087</p></div><div><span className="live-dot"/> Shift Dina aktif</div></div>
      <div className="pos-layout">
        <main className="pos-menu">
          <div className="pos-tools">
            <div className="categories"><button className="active">Semua</button><button>Paket</button><button>Ayam</button><button>Tambahan</button><button>Minuman</button></div>
            <label><Search size={18}/><input placeholder="Cari menu..." /></label>
          </div>
          <div className="menu-grid">
            {menuItems.map(item => (
              <button className="menu-card" key={item.id} onClick={() => clickMenu(item)}>
                <span className={`food-art ${item.color}`}>{item.icon}</span>
                <div><strong>{item.name}</strong><small>{item.note}</small><b>{money(item.price)}</b></div>
                <Plus size={17}/>
              </button>
            ))}
          </div>
          <div className="stock-ribbon">
            <span><i className="live-dot"/> STOK ETALASE</span>
            {Object.entries(cutStock).map(([name, count])=><div key={name}>{name}<strong>{count}</strong></div>)}
          </div>
        </main>
        <aside className="cart">
          <div className="cart-head"><div><h2>Pesanan #A-087</h2><p><ShoppingBag size={14}/> {channel}</p></div><button><Trash2 size={18}/></button></div>
          <div className="order-channel">{["Takeaway","Dine in","Online food"].map(item=><button key={item} className={channel===item?"active":""} onClick={()=>setChannel(item)}>{item}</button>)}</div>
          <div className="customer"><span>Nama pelanggan</span><button>+ Tambahkan nama</button></div>
          <div className="cart-list">
            {cart.map(item => (
              <div className="cart-item" key={item.id}>
                <div><strong>{item.name}</strong><small>{item.cut ? `Bagian: ${item.cut}` : item.name === "Air Mineral" ? "600 ml" : "1 item"}</small><b>{money(item.price * item.qty)}</b></div>
                <div className="qty"><button onClick={() => setCart(c=>c.filter(x=>x.id!==item.id))}><Minus/></button><span>{item.qty}</span><button onClick={() => setCart(c=>c.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x))}><Plus/></button></div>
              </div>
            ))}
            {!cart.length && <div className="empty-cart"><ShoppingBag/><strong>Keranjang kosong</strong><span>Pilih menu untuk memulai</span></div>}
          </div>
          <div className="totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Diskon</span><button>+ Tambah</button></div><div className="grand"><span>Total</span><strong>{money(subtotal)}</strong></div></div>
          <div className="pay-method"><span>Metode pembayaran</span><div><button className="active"><Banknote/>Tunai</button><button><Grid2X2/>QRIS</button></div></div>
          <button className="pay-button" disabled={!cart.length} onClick={()=>{setCash("");setPayment(true)}}><span>Bayar sekarang</span><strong>{money(subtotal)}</strong></button>
        </aside>
      </div>
      {cutPicker && <Modal close={()=>setCutPicker(null)}>
        <div className="modal-head"><div><span className="modal-icon">🍗</span><div><h2>Pilih bagian ayam</h2><p>{cutPicker.name}</p></div></div><button onClick={()=>setCutPicker(null)}><X/></button></div>
        <div className="cut-grid">{Object.entries(cutStock).map(([cut,stock])=><button key={cut} onClick={()=>addItem(cutPicker, cut as Cut)}><span>♨</span><strong>{cut}</strong><small>Tersedia {stock} potong</small><ArrowRight/></button>)}</div>
      </Modal>}
      {payment && <Modal close={()=>setPayment(false)}>
        <div className="modal-head"><div><span className="modal-icon"><Banknote/></span><div><h2>Pembayaran tunai</h2><p>Total pesanan #A-087</p></div></div><button onClick={()=>setPayment(false)}><X/></button></div>
        <div className="payment-total"><span>Total tagihan</span><strong>{money(subtotal)}</strong></div>
        <div className="cash-received"><span>Uang diterima</span><strong>{cash?money(Number(cash)):"Rp 0"}</strong></div>
        <div className="cash-presets">{[subtotal,50000,100000].filter((v,i,a)=>a.indexOf(v)===i).map(v=><button key={v} onClick={()=>setCash(String(v))}>{v===subtotal?"Uang pas":money(v).replace(",00","")}</button>)}</div>
        <div className="numpad">
          {[1,2,3,4,5,6,7,8,9,"00",0,"⌫"].map(key=><button key={key} onClick={()=>setCash(old=>key==="⌫"?old.slice(0,-1):`${old}${key}`.replace(/^0+/,""))}>{key}</button>)}
        </div>
        <div className={`change-box ${Number(cash)>=subtotal?"ready":""}`}><span>Kembalian</span><strong>{Number(cash)>=subtotal?money(Number(cash)-subtotal):"Nominal belum cukup"}</strong></div>
        <button className="primary-wide" disabled={Number(cash)<subtotal} onClick={()=>{setPayment(false);setPaid(true)}}>Konfirmasi pembayaran <ArrowRight/></button>
      </Modal>}
      {paid && <Modal close={()=>setPaid(false)}>
        <div className="success-modal"><span><Check/></span><h2>Pembayaran berhasil</h2><p>Pesanan <b>#A-087</b> sudah masuk ke antrean.</p><div><strong>{money(subtotal)}</strong><small>Tunai · Struk 58mm siap dicetak</small></div><button onClick={()=>{setPaid(false);setCart([])}}>Pesanan baru</button></div>
      </Modal>}
    </>
  );
}

function Production() {
  const [packs, setPacks] = useState(2);
  const [done, setDone] = useState(false);
  const [recipes, setRecipes] = useState([
    {name:"Sayap", qty:2, unit:"pcs"},
    {name:"Paha atas", qty:2, unit:"pcs"},
    {name:"Paha bawah", qty:2, unit:"pcs"},
    {name:"Dada", qty:3, unit:"pcs"},
  ]);
  const [recipeModal, setRecipeModal] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  return (
    <>
      <Topbar title="Produksi" subtitle="Kelola batch goreng dan kondisi deep fryer." />
      <main className="content production-page">
        <section className="production-grid">
          <div className="panel batch-builder">
            <div className="eyebrow"><span>01</span> BATCH BARU</div>
            <h2>Goreng ayam</h2><p>Pilih jumlah pak yang akan diproduksi.</p>
            <div className="pack-stepper"><button onClick={()=>setPacks(Math.max(1,packs-1))}><Minus/></button><div><strong>{packs}</strong><span>pak ayam</span></div><button onClick={()=>setPacks(packs+1)}><Plus/></button></div>
            <div className="recipe-preview">
              <h3>Kebutuhan otomatis</h3>
              <div><span>Ayam mentah</span><strong>{packs} pak</strong></div>
              <div><span>Tepung</span><strong>{(packs/3).toFixed(2).replace(".",",")} pak</strong></div>
              <div><span>Estimasi hasil</span><strong>{packs*9} potong</strong></div>
            </div>
            <button className="primary-wide" onClick={()=>setDone(true)}>Mulai produksi <ArrowRight/></button>
          </div>
          <div className="panel output-card">
            <div className="eyebrow"><span>02</span> HASIL STANDAR</div>
            <div className="section-title-action"><div><h2>Komposisi etalase</h2><p>Kelola hasil produksi yang masuk ke etalase.</p></div><button onClick={()=>setRecipeModal(true)}><Plus/> Tambah</button></div>
            {recipes.map((item)=><div className="output-row editable" key={item.name}><span className="chicken-symbol">♨</span><div><strong>{item.name}</strong><small>Hasil per 1 pak ayam</small></div><b>{item.qty*packs} {item.unit}</b><button onClick={()=>setRecipes(r=>r.filter(x=>x.name!==item.name))}>×</button></div>)}
          </div>
          <div className="panel oil-cycle">
            <div className="panel-head"><div><span className="eyebrow plain">DEEP FRYER 1</span><h2>Siklus minyak</h2></div><span className="status warning">Periksa</span></div>
            <div className="oil-hero"><div className="oil-drop">💧</div><div><strong>164 <small>/ 200 pak</small></strong><span>15 hari sejak pengisian</span></div></div>
            <div className="progress"><i style={{width:"82%"}}/></div>
            <div className="oil-metrics"><div><span>Top-up berikutnya</span><strong>6 / 10 pak</strong></div><div><span>Batas usia</span><strong>21 hari</strong></div></div>
            <div className="oil-actions"><button>Periksa minyak</button><button>Catat top-up</button></div>
          </div>
        </section>
        <section className="panel recent-batches">
          <div className="panel-head"><div><h2>Produksi hari ini</h2><p>5 batch · 10 pak ayam</p></div><button>Riwayat lengkap</button></div>
          <table><thead><tr><th>Waktu</th><th>Batch</th><th>Ayam mentah</th><th>Hasil</th><th>Operator</th><th>Status</th></tr></thead><tbody>
            {[["13:42","#B-025","2 pak","18 pcs","Dina"],["11:18","#B-024","2 pak","18 pcs","Raka"],["09:35","#B-023","2 pak","17 pcs","Dina"]].map((r,i)=><tr key={r[1]}>{r.map(c=><td key={c}>{c}</td>)}<td><span className={i===2?"status warning":"status success"}>{i===2?"Susut 1":"Sesuai"}</span></td></tr>)}
          </tbody></table>
        </section>
      </main>
      {done && <Modal close={()=>setDone(false)}><div className="success-modal"><span><Check/></span><h2>Batch #{`B-026`} dimulai</h2><p>Bahan baku sudah dialokasikan untuk produksi.</p><div><strong>{packs*9} potong</strong><small>{packs} pak ayam · {(packs/3).toFixed(2).replace(".",",")} pak tepung</small></div><button onClick={()=>setDone(false)}>Kembali ke produksi</button></div></Modal>}
      {recipeModal && <Modal close={()=>setRecipeModal(false)}>
        <div className="modal-head"><div><span className="modal-icon"><CookingPot/></span><div><h2>Tambah hasil produksi</h2><p>Buat item baru untuk komposisi etalase.</p></div></div><button onClick={()=>setRecipeModal(false)}><X/></button></div>
        <div className="crud-form"><label>Nama hasil<input value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Contoh: kulit crispy"/></label><div><label>Jumlah per pak<input type="number" defaultValue="1"/></label><label>Satuan<select><option>pcs</option><option>porsi</option><option>gram</option></select></label></div><button onClick={()=>{if(recipeName.trim())setRecipes(r=>[...r,{name:recipeName,qty:1,unit:"pcs"}]);setRecipeName("");setRecipeModal(false)}}>Simpan komposisi</button></div>
      </Modal>}
    </>
  );
}

function Inventory() {
  const [rows, setRows] = useState([
    ["Ayam mentah","Bahan baku","12 pak","Cukup untuk 6 batch","good"],
    ["Tepung bumbu","Bahan baku","1,3 pak","Cukup untuk 3 pak ayam","low"],
    ["Minyak goreng","Bahan baku","9 pouch","18 liter","good"],
    ["Kemasan ayam","Pendamping","84 pcs","Batas minimum 50","good"],
    ["Nasi siap saji","Siap jual","21 porsi","Dibuat 10:30","good"],
    ["Saus sachet","Pendamping","38 pcs","Batas minimum 40","low"],
  ]);
  const [stockModal,setStockModal]=useState(false);
  const [stockName,setStockName]=useState("");
  return <>
    <Topbar title="Persediaan" subtitle="Stok bahan, etalase, dan barang pendamping."/>
    <main className="content inventory-page">
      <div className="summary-cards"><div><span className="quick-icon red"><Boxes/></span><p>Total item<strong>28</strong></p></div><div><span className="quick-icon amber"><PackageOpen/></span><p>Stok menipis<strong>3 item</strong></p></div><div><span className="quick-icon green"><Check/></span><p>Stok sesuai<strong>25 item</strong></p></div></div>
      <section className="panel">
          <div className="inventory-toolbar"><div className="categories"><button className="active">Semua</button><button>Bahan baku</button><button>Siap jual</button><button>Pendamping</button></div><div><label><Search/><input placeholder="Cari persediaan"/></label><button className="stock-button" onClick={()=>setStockModal(true)}><Plus/> Tambah item</button></div></div>
        <table><thead><tr><th>Nama item</th><th>Kelompok</th><th>Stok tersedia</th><th>Keterangan</th><th>Status</th><th></th></tr></thead><tbody>
          {rows.map(r=><tr key={r[0]}><td><span className="table-item-icon">◫</span><strong>{r[0]}</strong></td><td>{r[1]}</td><td><strong>{r[2]}</strong></td><td>{r[3]}</td><td><span className={`status ${r[4]==="low"?"danger":"success"}`}>{r[4]==="low"?"Menipis":"Aman"}</span></td><td><div className="row-actions"><button title="Edit">✎</button><button title="Hapus" onClick={()=>setRows(old=>old.filter(x=>x[0]!==r[0]))}>×</button></div></td></tr>)}
        </tbody></table>
      </section>
    </main>
    {stockModal && <Modal close={()=>setStockModal(false)}><div className="modal-head"><div><span className="modal-icon"><Boxes/></span><div><h2>Tambah persediaan</h2><p>Buat item dan aturan satuannya.</p></div></div><button onClick={()=>setStockModal(false)}><X/></button></div><div className="crud-form"><label>Nama item<input value={stockName} onChange={e=>setStockName(e.target.value)} placeholder="Nama bahan atau barang"/></label><div><label>Kelompok<select><option>Bahan baku</option><option>Siap jual</option><option>Pendamping</option></select></label><label>Satuan dasar<select><option>pak</option><option>pcs</option><option>gram</option><option>liter</option><option>porsi</option></select></label></div><label>Stok minimum<input type="number" placeholder="0"/></label><button onClick={()=>{if(stockName.trim())setRows(old=>[[stockName,"Bahan baku","0 pak","Item baru","low"],...old]);setStockName("");setStockModal(false)}}>Simpan item</button></div></Modal>}
  </>;
}

function Drawer() {
  const [modal, setModal] = useState<"in"|"out"|null>(null);
  return <>
    <Topbar title="Kas & Shift" subtitle="Shift pagi · Dibuka pukul 08:02 oleh Dina"/>
    <main className="content drawer-page">
      <section className="drawer-hero">
        <div><span>SALDO DRAWER SAAT INI</span><strong>Rp 726.000</strong><p><span className="live-dot"/> Shift aktif selama 6 jam 24 menit</p></div>
        <div className="drawer-breakdown"><div><small>Modal awal wajib</small><strong>Rp 350.000</strong></div><div><small>Penjualan tunai</small><strong>Rp 426.000</strong></div><div><small>Kas masuk / keluar</small><strong>− Rp 50.000</strong></div></div>
      </section>
      <section className="cash-actions"><button onClick={()=>setModal("in")}><span className="quick-icon green"><ArrowDownLeft/></span><div><strong>Cash-in</strong><small>Tambahkan uang ke drawer</small></div><Plus/></button><button onClick={()=>setModal("out")}><span className="quick-icon red"><ArrowUpRight/></span><div><strong>Cash-out</strong><small>Keluarkan uang dari drawer</small></div><Minus/></button><button><span className="quick-icon amber"><ShieldCheck/></span><div><strong>Tutup shift</strong><small>Hitung fisik & rekonsiliasi</small></div><ArrowRight/></button></section>
      <section className="two-col drawer-cols">
        <div className="panel">
          <div className="panel-head"><div><h2>Aktivitas kas hari ini</h2><p>Selain transaksi penjualan</p></div></div>
          <div className="cash-row"><span className="cash-type out"><ArrowUpRight/></span><div><strong>Belanja kebutuhan outlet</strong><small>12:46 · Dina · Nota dilampirkan</small></div><b>− Rp 50.000</b></div>
          <div className="cash-row"><span className="cash-type in"><ArrowDownLeft/></span><div><strong>Tambahan uang kembalian</strong><small>09:15 · Dina · Disetujui owner</small></div><b>+ Rp 100.000</b></div>
          <div className="cash-row"><span className="cash-type out"><ArrowUpRight/></span><div><strong>Cash drop ke brankas</strong><small>08:30 · Dina</small></div><b>− Rp 100.000</b></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><h2>Ringkasan pembayaran</h2><p>86 transaksi hari ini</p></div></div>
          <div className="payment-summary"><div><span className="payment-icon cash"><Banknote/></span><p>Tunai<small>34 transaksi</small></p><strong>Rp 826.000</strong></div><div><span className="payment-icon qris"><Grid2X2/></span><p>QRIS manual<small>52 transaksi</small></p><strong>Rp 1.654.000</strong></div></div>
          <div className="drawer-note"><ShieldCheck/><p><strong>Modal Rp350.000 terlindungi</strong><span>Cash-out yang melewati batas aman membutuhkan PIN owner.</span></p></div>
        </div>
      </section>
    </main>
    {modal && <Modal close={()=>setModal(null)}>
      <div className="modal-head"><div><span className={`modal-icon ${modal}`}>{modal==="in"?<ArrowDownLeft/>:<ArrowUpRight/>}</span><div><h2>{modal==="in"?"Catat cash-in":"Catat cash-out"}</h2><p>Saldo drawer saat ini Rp726.000</p></div></div><button onClick={()=>setModal(null)}><X/></button></div>
      <div className="cash-form"><label>Nominal<div><span>Rp</span><input autoFocus placeholder="0"/></div></label><label>Kategori<select defaultValue=""><option value="" disabled>Pilih kategori</option><option>{modal==="in"?"Tambahan uang kembalian":"Belanja kebutuhan outlet"}</option><option>{modal==="in"?"Pengembalian pembelian":"Cash drop ke brankas"}</option></select></label><label>Catatan<textarea placeholder="Tambahkan keterangan..."/></label><button onClick={()=>setModal(null)}>Simpan transaksi</button><p><ShieldCheck/> Transaksi sensitif akan meminta PIN owner.</p></div>
    </Modal>}
  </>;
}

function Reports() {
  return <>
    <Topbar title="Laporan" subtitle="Analisa penjualan, produksi, dan operasional outlet."/>
    <main className="content report-page">
      <section className="period-bar"><div><button className="active">Hari ini</button><button>Kemarin</button><button>Minggu ini</button><button>Bulan ini</button><button>All time</button></div><button className="custom-period"><Clock3/> Periode khusus</button></section>
      <section className="report-tabs"><button className="active">Penjualan</button><button>Produk</button><button>Produksi</button><button>Persediaan</button><button>Kas</button></section>
      <section className="report-kpis"><div><span>Penjualan bersih</span><strong>Rp2.480.000</strong><small>↑ 12,4% dari periode lalu</small></div><div><span>Jumlah transaksi</span><strong>86</strong><small>↑ 8 transaksi</small></div><div><span>Rata-rata transaksi</span><strong>Rp28.837</strong><small>↑ 3,1%</small></div><div><span>Item terjual</span><strong>174</strong><small>2,02 item/transaksi</small></div></section>
      <section className="two-col report-charts"><div className="panel"><div className="panel-head"><div><h2>Tren penjualan</h2><p>Omzet dan jumlah transaksi per jam</p></div></div><div className="line-chart"><svg viewBox="0 0 600 170" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a80f16" stopOpacity=".22"/><stop offset="100%" stopColor="#a80f16" stopOpacity="0"/></linearGradient></defs><path d="M0,145 C60,140 65,110 120,118 S185,82 240,94 S300,38 360,61 S430,26 480,48 S545,40 600,18 L600,170 L0,170Z" fill="url(#fill)"/><path d="M0,145 C60,140 65,110 120,118 S185,82 240,94 S300,38 360,61 S430,26 480,48 S545,40 600,18" fill="none" stroke="#a80f16" strokeWidth="4"/></svg><div>{["08","09","10","11","12","13","14","15"].map(x=><span key={x}>{x}:00</span>)}</div></div></div><div className="panel"><div className="panel-head"><div><h2>Menu terlaris</h2><p>Berdasarkan jumlah item</p></div></div>{[["Paket Ayam Nasi",46,100],["Ayam Crispy",32,70],["Rice Bowl",24,52],["Paket Berdua",18,39]].map((r,i)=><div className="rank-row" key={r[0]}><b>{i+1}</b><div><span>{r[0]}<strong>{r[1]} item</strong></span><i><em style={{width:`${r[2]}%`}}/></i></div></div>)}</div></section>
    </main>
  </>;
}

function ActivityLog() {
  const events=[["14:24","Dina","Menyelesaikan transaksi #A-086","Tunai · Rp42.000"],["13:42","Dina","Memulai produksi batch #B-025","2 pak ayam · 18 potong"],["12:46","Dina","Mencatat cash-out","Belanja outlet · Rp50.000"],["11:18","Raka","Mengoreksi hasil produksi #B-024","Disetujui PIN owner"],["10:05","Dina","Konversi stok","2 sayap → 2 topping rice bowl"],["09:15","Dina","Mencatat cash-in","Uang kembalian · Rp100.000"]];
  return <><Topbar title="Riwayat aktivitas" subtitle="Jejak lengkap perubahan dan aktivitas operator."/><main className="content"><section className="panel"><div className="log-toolbar"><div className="categories"><button className="active">Semua</button><button>Kasir</button><button>Produksi</button><button>Stok</button><button>Kas</button><button>Approval owner</button></div><label><Search/><input placeholder="Cari aktivitas..."/></label></div><div className="timeline">{events.map((e,i)=><div className="timeline-row" key={e[0]+e[2]}><span className={`timeline-dot t${i%4}`}/><time>{e[0]}</time><div className="avatar small">{e[1].slice(0,2).toUpperCase()}</div><p><strong>{e[1]}</strong><span>{e[2]}</span><small>{e[3]}</small></p><button>Detail</button></div>)}</div></section></main></>;
}

function SettingsPage() {
  const [autoPrint,setAutoPrint]=useState(true);
  const [kitchenPrint,setKitchenPrint]=useState(false);
  return <><Topbar title="Pengaturan" subtitle="Atur perilaku kasir dan operasional outlet."/><main className="content settings-page"><aside className="settings-nav"><button className="active">Kasir & printer</button><button>Outlet</button><button>Produksi</button><button>Persediaan</button><button>PIN owner</button><button>Operator</button></aside><section className="panel settings-content"><div className="settings-title"><h2>Kasir & printer</h2><p>Konfigurasi pembayaran dan pencetakan struk.</p></div><div className="setting-row"><div><strong>Cetak struk otomatis</strong><span>Struk langsung dicetak setelah pembayaran berhasil.</span></div><button className={`switch ${autoPrint?"on":""}`} onClick={()=>setAutoPrint(!autoPrint)}><i/></button></div><div className="setting-row"><div><strong>Cetak tiket dapur</strong><span>Kirim tiket pesanan ke printer produksi.</span></div><button className={`switch ${kitchenPrint?"on":""}`} onClick={()=>setKitchenPrint(!kitchenPrint)}><i/></button></div><div className="setting-field"><label>Ukuran kertas</label><select defaultValue="58"><option value="58">Thermal 58 mm</option><option value="80">Thermal 80 mm</option></select></div><div className="setting-field"><label>Printer struk</label><select><option>Printer kasir utama</option><option>Belum terhubung</option></select></div><div className="receipt-preview"><span>PRATINJAU STRUK</span><div><b>SABANA FRIED CHICKEN</b><small>Pesanan #A-087 · Takeaway</small><hr/><p>1x Paket Ayam Nasi <em>Rp19.000</em></p><p>1x Ayam Crispy <em>Rp13.000</em></p><hr/><strong>TOTAL <em>Rp32.000</em></strong><small>Terima kasih!</small></div></div><button className="save-settings">Simpan pengaturan</button></section></main></>;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} />
      <section className="workspace">
        {view === "dashboard" && <Dashboard setView={setView}/>}
        {view === "kasir" && <POS/>}
        {view === "produksi" && <Production/>}
        {view === "stok" && <Inventory/>}
        {view === "drawer" && <Drawer/>}
        {view === "laporan" && <Reports/>}
        {view === "riwayat" && <ActivityLog/>}
        {view === "pengaturan" && <SettingsPage/>}
      </section>
    </div>
  );
}
