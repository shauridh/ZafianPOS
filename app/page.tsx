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
  ChevronLeft,
  ChevronRight,
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
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { completeProductionBatch, createCategory, createInventoryItem, createProduct, listCategories, listInventory, listProducts, loadBusinessProfile, saveBusinessProfile, uploadMenuImage } from "../lib/repository";

type View = "dashboard" | "kasir" | "menu" | "produksi" | "stok" | "drawer" | "laporan" | "riwayat" | "pengaturan";
type Cut = "Dada" | "Paha atas" | "Paha bawah" | "Sayap";
type CartItem = { id: number; name: string; cut?: Cut; price: number; qty: number };
type BusinessProfile = { name: string; tagline: string; primaryColor: string; sidebarColor: string; outlet: string };
type MenuItem = { id: number | string; name: string; note: string; price: number; icon: string; color: string; image?: string };

const defaultBusiness: BusinessProfile = {
  name: "Sabana",
  tagline: "Operation Hub",
  primaryColor: "#a80f16",
  sidebarColor: "#211d1a",
  outlet: "Outlet Utama",
};

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const cutStock: Record<Cut, number> = { Dada: 6, "Paha atas": 4, "Paha bawah": 4, Sayap: 4 };

const menuItems: MenuItem[] = [
  { id: 1, name: "Ayam Crispy", note: "1 potong", price: 13000, icon: "🍗", color: "sun" },
  { id: 2, name: "Paket Ayam Nasi", note: "Ayam + nasi", price: 19000, icon: "🍱", color: "cream" },
  { id: 3, name: "Rice Bowl", note: "Ayam suwir", price: 16000, icon: "🥣", color: "orange" },
  { id: 4, name: "Paket Berdua", note: "2 ayam + 2 nasi", price: 36000, icon: "🍗", color: "red" },
  { id: 5, name: "Nasi Putih", note: "1 porsi", price: 5000, icon: "🍚", color: "cream" },
  { id: 6, name: "Air Mineral", note: "600 ml", price: 4000, icon: "💧", color: "blue" },
  { id: 7, name: "Saus Extra", note: "2 sachet", price: 2000, icon: "🌶️", color: "red" },
  { id: 8, name: "Kulit Crispy", note: "1 pouch", price: 9000, icon: "✨", color: "sun" },
];

function Brand({ business }: { business: BusinessProfile }) {
  return (
    <div className="brand">
      <div className="brand-mark"><Flame size={22} strokeWidth={2.6} /></div>
      <div><strong>{business.name.toUpperCase()}</strong><span>{business.tagline.toUpperCase()}</span></div>
    </div>
  );
}

const nav = [
  { id: "dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { id: "kasir", label: "Kasir", icon: ShoppingBag },
  { id: "menu", label: "Menu & Kategori", icon: Grid2X2 },
  { id: "produksi", label: "Produksi", icon: CookingPot },
  { id: "stok", label: "Persediaan", icon: Boxes },
  { id: "drawer", label: "Kas & Shift", icon: WalletCards },
] as const;

const secondaryNav = [
  { id: "laporan", label: "Laporan", icon: BarChart3 },
  { id: "riwayat", label: "Riwayat aktivitas", icon: History },
  { id: "pengaturan", label: "Pengaturan", icon: Settings },
] as const;

function Sidebar({ view, setView, business, collapsed, setCollapsed }: { view: View; setView: (view: View) => void; business: BusinessProfile; collapsed: boolean; setCollapsed: (value:boolean)=>void }) {
  return (
    <aside className={`sidebar ${collapsed?"collapsed":""}`} style={{background:business.sidebarColor}}>
      <Brand business={business} />
      <button className="collapse-sidebar" onClick={()=>setCollapsed(!collapsed)} title={collapsed?"Buka sidebar":"Tutup sidebar"}>{collapsed?<ChevronRight/>:<ChevronLeft/>}</button>
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
            <div className="panel-head"><div><h2>Kondisi deep fryer</h2><p>Belum ada siklus minyak aktif</p></div><span className="status neutral">Belum dimulai</span></div>
            <div className="fryer-main">
              <div className="gauge empty"><span>0</span><small>/200 pak</small></div>
              <div className="fryer-stats">
                <div><span>Umur minyak</span><strong>0 hari</strong><small>Diisi saat mulai</small></div>
                <div><span>Top-up</span><strong>0 / 10 pak</strong><small>Belum dihitung</small></div>
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
  const [catalog,setCatalog]=useState(menuItems);
  const [cart, setCart] = useState<CartItem[]>([
    { id: 101, name: "Paket Ayam Nasi", cut: "Dada", price: 19000, qty: 1 },
    { id: 102, name: "Ayam Crispy", cut: "Paha atas", price: 13000, qty: 1 },
  ]);
  const [cutPicker, setCutPicker] = useState<MenuItem | null>(null);
  const [paid, setPaid] = useState(false);
  const [payment, setPayment] = useState(false);
  const [channel, setChannel] = useState("Takeaway");
  const [onlineProvider, setOnlineProvider] = useState("GoFood");
  const [cash, setCash] = useState("");
  const [cashPresetActive, setCashPresetActive] = useState(false);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  useEffect(()=>{listProducts<Record<string, unknown>>([]).then(items=>{if(items.length)setCatalog(items.map((item,index)=>({
    id:String(item.id ?? index), name:String(item.name ?? "Menu"), note:String(item.description ?? "Menu kasir"),
    price:Number(item.sale_price ?? item.salePrice ?? 0), icon:"🍽️", color:"cream",
    image:String(item.image_path ?? item.imagePath ?? "") || undefined,
  })))}).catch(()=>undefined)},[]);
  const addItem = (item: MenuItem, cut?: Cut) => {
    setCart((prev) => [...prev, { id: Date.now(), name: item.name, price: item.price, qty: 1, cut }]);
    setCutPicker(null);
  };
  const clickMenu = (item: MenuItem) => {
    if ([1,2,4].includes(Number(item.id))) setCutPicker(item); else addItem(item);
  };
  return (
    <>
      <div className="pos-topbar"><div><h1>Kasir</h1><p>{channel} · Pesanan #A-087</p></div><div className="header-display-stock"><span>STOK ETALASE</span>{Object.entries(cutStock).map(([name,count])=><div key={name}><small>{name}</small><strong>{count}</strong></div>)}</div><div className="pos-shift"><span className="live-dot"/> Shift Dina aktif</div></div>
      <div className="pos-layout">
        <main className="pos-menu">
          <div className="pos-tools">
            <div className="categories"><button className="active">Semua</button><button>Paket</button><button>Ayam</button><button>Tambahan</button><button>Minuman</button></div>
            <label><Search size={18}/><input placeholder="Cari menu..." /></label>
          </div>
          <div className="menu-grid">
            {catalog.map(item => (
              <button className="menu-card" key={item.id} onClick={() => clickMenu(item)}>
                <span className={`food-art ${item.color}`}>{item.image?<img src={item.image} alt={item.name}/>:item.icon}</span>
                <div><strong>{item.name}</strong><small>{item.note}</small><b>{money(item.price)}</b></div>
                <Plus size={17}/>
              </button>
            ))}
          </div>
        </main>
        <aside className="cart">
          <div className="cart-head"><div><h2>Pesanan #A-087</h2><p><ShoppingBag size={14}/> {channel}</p></div><button><Trash2 size={18}/></button></div>
          <div className="order-channel">{["Takeaway","Dine in","Online food"].map(item=><button key={item} className={channel===item?"active":""} onClick={()=>setChannel(item)}>{item}</button>)}</div>
          {channel==="Online food" && <div className="online-provider">{["GoFood","GrabFood","ShopeeFood"].map(item=><button key={item} className={onlineProvider===item?"active":""} onClick={()=>setOnlineProvider(item)}>{item}</button>)}</div>}
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
          <button className="pay-button" disabled={!cart.length} onClick={()=>{setCash("");setCashPresetActive(false);setPayment(true)}}><span>Bayar sekarang</span><strong>{money(subtotal)}</strong></button>
        </aside>
      </div>
      {cutPicker && <Modal close={()=>setCutPicker(null)}>
        <div className="modal-head"><div><span className="modal-icon">🍗</span><div><h2>Pilih bagian ayam</h2><p>{cutPicker.name}</p></div></div><button onClick={()=>setCutPicker(null)}><X/></button></div>
        <div className="cut-grid">{Object.entries(cutStock).map(([cut,stock])=><button key={cut} onClick={()=>addItem(cutPicker, cut as Cut)}><span>♨</span><strong>{cut}</strong><small>Tersedia {stock} potong</small><ArrowRight/></button>)}</div>
      </Modal>}
      {payment && <Modal close={()=>setPayment(false)}>
        <div className="modal-head"><div><span className="modal-icon"><Banknote/></span><div><h2>Pembayaran tunai</h2><p>Total pesanan #A-087</p></div></div><button onClick={()=>setPayment(false)}><X/></button></div>
        <div className="payment-total"><span>Total tagihan</span><strong>{money(subtotal)}</strong></div>
        <label className="cash-received"><span>Uang diterima</span><div><small>Rp</small><input inputMode="numeric" autoFocus value={cash} onChange={e=>{setCashPresetActive(false);setCash(e.target.value.replace(/\D/g,""))}} placeholder="0"/></div></label>
        <div className="cash-presets">{[subtotal,50000,100000].filter((v,i,a)=>a.indexOf(v)===i).map(v=><button key={v} onClick={()=>{setCash(String(v));setCashPresetActive(true)}}>{v===subtotal?"Uang pas":money(v).replace(",00","")}</button>)}</div>
        <div className="numpad">
          {[1,2,3,4,5,6,7,8,9,"00",0,"⌫"].map(key=><button key={key} onClick={()=>{setCash(old=>key==="⌫"?(cashPresetActive?"":old.slice(0,-1)):cashPresetActive?String(key):`${old}${key}`.replace(/^0+/,""));setCashPresetActive(false)}}>{key}</button>)}
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

function MenuManagement() {
  const [categories,setCategories]=useState(["Paket","Ayam","Rice bowl","Tambahan","Minuman"]);
  const [activeCategory,setActiveCategory]=useState("Semua");
  const [products,setProducts]=useState(menuItems);
  const [modal,setModal]=useState<"menu"|"category"|null>(null);
  const [newName,setNewName]=useState("");
  const [menuImage,setMenuImage]=useState("");
  const [menuPrice,setMenuPrice]=useState("");
  const [menuCategory,setMenuCategory]=useState(categories[0]);
  const [imageError,setImageError]=useState("");
  useEffect(()=>{listCategories(categories).then(setCategories).catch(()=>undefined)},[]);
  return <>
    <Topbar title="Menu & Kategori" subtitle="Kelola katalog, harga franchise, dan resep penjualan kasir."/>
    <main className="content menu-management">
      <section className="menu-admin-head">
        <div className="menu-admin-summary"><span className="quick-icon red"><Grid2X2/></span><div><strong>{products.length} menu aktif</strong><small>{categories.length} kategori · sinkron dengan kasir</small></div></div>
        <div><button className="secondary-action" onClick={()=>setModal("category")}><Plus/> Kategori</button><button className="stock-button" onClick={()=>setModal("menu")}><Plus/> Tambah menu</button></div>
      </section>
      <section className="menu-admin-layout">
        <aside className="panel category-panel"><div className="panel-head"><div><h2>Kategori</h2><p>Urutan tampil di kasir</p></div></div>{["Semua",...categories].map((item,i)=><button className={activeCategory===item?"active":""} key={item} onClick={()=>setActiveCategory(item)}><span>{item}</span><small>{item==="Semua"?products.length:Math.max(1,products.length-i)}</small>{item!=="Semua"&&<b>⋮</b>}</button>)}</aside>
        <section className="panel product-table"><div className="panel-head"><div><h2>{activeCategory}</h2><p>Produk dapat disusun dan diaktifkan untuk kasir.</p></div><label><Search/><input placeholder="Cari menu..."/></label></div>
          <table><thead><tr><th>Menu</th><th>Kategori</th><th>Harga jual</th><th>Resep penjualan</th><th>Status</th><th></th></tr></thead><tbody>{products.map((item,i)=><tr key={item.id}><td><div className={`mini-food ${item.color}`}>{item.image?<img src={item.image} alt={item.name}/>:item.icon}</div><strong>{item.name}</strong></td><td>{categories[i%categories.length]}</td><td><strong>{money(item.price)}</strong></td><td><span className="recipe-count">{Number(item.id)<=4?"3–4 bahan":"1 bahan"}</span></td><td><span className="status success">Aktif</span></td><td><div className="row-actions"><button>✎</button><button onClick={()=>setProducts(old=>old.filter(x=>x.id!==item.id))}>×</button></div></td></tr>)}</tbody></table>
        </section>
      </section>
    </main>
    {modal && <Modal close={()=>setModal(null)}><div className="modal-head"><div><span className="modal-icon">{modal==="menu"?<ShoppingBag/>:<Grid2X2/>}</span><div><h2>{modal==="menu"?"Tambah menu kasir":"Tambah kategori"}</h2><p>{modal==="menu"?"Atur katalog dan bahan yang dipakai saat terjual.":"Kelompokkan menu agar kasir lebih cepat."}</p></div></div><button onClick={()=>setModal(null)}><X/></button></div><div className="crud-form">{modal==="menu"&&<><label className="image-upload">{menuImage?<img src={menuImage} alt="Pratinjau menu"/>:<span><ShoppingBag/>Upload gambar menu<small>JPG, PNG, atau WebP, maks. 2 MB</small></span>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setImageError("");try{setMenuImage(await uploadMenuImage(file))}catch(error){setImageError(error instanceof Error?error.message:"Gambar gagal diunggah.")}}}/></label>{imageError&&<small className="form-error">{imageError}</small>}</>}<label>Nama {modal==="menu"?"menu":"kategori"}<input value={newName} onChange={e=>setNewName(e.target.value)} placeholder={modal==="menu"?"Contoh: Paket Hemat":"Contoh: Promo"}/></label>{modal==="menu"&&<><div><label>Kategori<select value={menuCategory} onChange={e=>setMenuCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Harga franchise<input type="number" value={menuPrice} onChange={e=>setMenuPrice(e.target.value)} placeholder="0"/></label></div><label>Resep penjualan<div className="ingredient-placeholder"><span>Ayam matang — 1 pcs</span><span>Kemasan — 1 pcs</span><button>+ Tambah bahan</button></div></label></>}<button onClick={async()=>{if(newName.trim()){if(modal==="category"){await createCategory(newName,categories);setCategories(c=>[...c,newName])}else{const price=Number(menuPrice||0);await createProduct({name:newName,salePrice:price,categoryName:menuCategory,imagePath:menuImage});setProducts(p=>[...p,{id:Date.now(),name:newName,note:"Menu baru",price,icon:"🍽️",color:"cream",image:menuImage||undefined}])}}setNewName("");setMenuImage("");setMenuPrice("");setImageError("");setModal(null)}}>Simpan {modal==="menu"?"menu":"kategori"}</button></div></Modal>}
  </>;
}

function Production() {
  const [packs, setPacks] = useState(2);
  const [done, setDone] = useState<{batch:string;total:number}|null>(null);
  const [productionMenus,setProductionMenus]=useState([
    {id:"fried-chicken",name:"Goreng ayam",inputName:"Ayam mentah",inputUnit:"pak"},
    {id:"rice",name:"Masak nasi",inputName:"Beras",inputUnit:"kg"},
  ]);
  const [activeMenu,setActiveMenu]=useState("fried-chicken");
  const [outputs,setOutputs]=useState([
    {id:"wing",menuId:"fried-chicken",name:"Sayap",qty:2,unit:"pcs",stock:4},
    {id:"upper",menuId:"fried-chicken",name:"Paha atas",qty:2,unit:"pcs",stock:4},
    {id:"lower",menuId:"fried-chicken",name:"Paha bawah",qty:2,unit:"pcs",stock:4},
    {id:"breast",menuId:"fried-chicken",name:"Dada",qty:3,unit:"pcs",stock:6},
    {id:"rice-portion",menuId:"rice",name:"Nasi siap saji",qty:10,unit:"porsi",stock:21},
  ]);
  const [outputModal,setOutputModal]=useState<{mode:"add"|"edit";id?:string}|null>(null);
  const [menuModal,setMenuModal]=useState<{mode:"add"|"edit";id?:string}|null>(null);
  const [oilActive,setOilActive]=useState(false);
  const [oilModal,setOilModal]=useState(false);
  const [batchBusy,setBatchBusy]=useState(false);
  const [batchError,setBatchError]=useState("");
  const [batches,setBatches]=useState([
    {time:"13:42",batch:"#B-025",input:"2 pak",result:"18 pcs",operator:"Dina",status:"Sesuai"},
    {time:"11:18",batch:"#B-024",input:"2 pak",result:"18 pcs",operator:"Raka",status:"Sesuai"},
    {time:"09:35",batch:"#B-023",input:"2 pak",result:"17 pcs",operator:"Dina",status:"Susut 1"},
  ]);
  const menu=productionMenus.find(item=>item.id===activeMenu) ?? productionMenus[0]!;
  const activeOutputs=outputs.filter(item=>item.menuId===activeMenu);
  const estimatedTotal=activeOutputs.reduce((sum,item)=>sum+item.qty*packs,0);
  const startBatch=async()=>{
    setBatchBusy(true);setBatchError("");
    try{
      const completed=await completeProductionBatch(menu.id,packs,estimatedTotal);
      const batchNumber=completed.batchNumber.startsWith("#")?completed.batchNumber:`#${completed.batchNumber}`;
      setOutputs(current=>current.map(item=>item.menuId===activeMenu?{...item,stock:item.stock+(item.qty*packs)}:item));
      setBatches(current=>[{time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),batch:batchNumber,input:`${packs} ${menu.inputUnit}`,result:`${completed.totalOutput} ${activeOutputs[0]?.unit ?? "unit"}`,operator:"Dina",status:"Sesuai"},...current]);
      setDone({batch:batchNumber,total:completed.totalOutput});
    }catch(error){setBatchError(error instanceof Error?error.message:"Batch gagal disimpan.")}
    finally{setBatchBusy(false)}
  };
  return (
    <>
      <Topbar title="Produksi" subtitle="Kelola batch goreng dan kondisi deep fryer." />
      <main className="content production-page">
        <section className="production-grid">
          <div className="panel batch-builder">
            <div className="eyebrow"><span>01</span> BATCH BARU</div>
            <div className="section-title-action"><div><h2>{menu.name}</h2><p>Pilih menu dan jumlah yang akan diproduksi.</p></div><button onClick={()=>setMenuModal({mode:"add"})}><Plus/> Menu</button></div>
            <div className="production-menu-tabs">{productionMenus.map(item=><button key={item.id} className={activeMenu===item.id?"active":""} onClick={()=>setActiveMenu(item.id)}>{item.name}</button>)}</div>
            <div className="production-menu-actions"><button onClick={()=>setMenuModal({mode:"edit",id:menu.id})}>Edit menu</button>{productionMenus.length>1&&<button onClick={()=>{const remaining=productionMenus.filter(item=>item.id!==menu.id);setProductionMenus(remaining);setOutputs(items=>items.filter(item=>item.menuId!==menu.id));setActiveMenu(remaining[0].id)}}>Hapus</button>}</div>
            <div className="pack-stepper"><button onClick={()=>setPacks(Math.max(1,packs-1))}><Minus/></button><div><strong>{packs}</strong><span>{menu.inputUnit} {menu.inputName.toLowerCase()}</span></div><button onClick={()=>setPacks(packs+1)}><Plus/></button></div>
            <div className="recipe-preview">
              <h3>Kebutuhan otomatis</h3>
              <div><span>{menu.inputName}</span><strong>{packs} {menu.inputUnit}</strong></div>
              {activeMenu==="fried-chicken"&&<div><span>Tepung</span><strong>{(packs/3).toFixed(2).replace(".",",")} pak</strong></div>}
              <div><span>Estimasi hasil</span><strong>{estimatedTotal} unit</strong></div>
            </div>
            {batchError&&<small className="form-error batch-error">{batchError}</small>}
            <button className="primary-wide" disabled={!activeOutputs.length||batchBusy} onClick={startBatch}>{batchBusy?"Menyimpan batch...":"Selesaikan & tambah hasil"} <ArrowRight/></button>
          </div>
          <div className="panel output-card">
            <div className="eyebrow"><span>02</span> HASIL BATCH</div>
            <div className="section-title-action"><div><h2>Hasil produksi</h2><p>Stok bertambah otomatis saat batch diselesaikan.</p></div><button onClick={()=>setOutputModal({mode:"add"})}><Plus/> Tambah</button></div>
            {activeOutputs.map(item=><div className="output-row editable" key={item.id}><span className="chicken-symbol">♨</span><div><strong>{item.name}</strong><small>{item.qty} {item.unit} per {menu.inputUnit} · stok {item.stock} {item.unit}</small></div><b>+{item.qty*packs} {item.unit}</b><div className="row-actions"><button title="Edit" onClick={()=>setOutputModal({mode:"edit",id:item.id})}>✎</button><button title="Hapus" onClick={()=>setOutputs(current=>current.filter(output=>output.id!==item.id))}>×</button></div></div>)}
            {!activeOutputs.length&&<div className="empty-production"><CookingPot/><strong>Belum ada hasil produksi</strong><span>Tambahkan komposisi hasil untuk menu ini.</span></div>}
          </div>
          <div className="panel oil-cycle">
            <div className="panel-head"><div><span className="eyebrow plain">DEEP FRYER 1</span><h2>Siklus minyak</h2></div><span className={`status ${oilActive?"success":"neutral"}`}>{oilActive?"Aktif":"Belum dimulai"}</span></div>
            <div className="oil-hero"><div className="oil-drop">💧</div><div><strong>0 <small>/ 200 pak</small></strong><span>{oilActive?"Dimulai hari ini":"Catat pengisian/pergantian pertama"}</span></div></div>
            <div className="progress"><i style={{width:"0%"}}/></div>
            <div className="oil-metrics"><div><span>Top-up berikutnya</span><strong>0 / 10 pak</strong></div><div><span>Batas usia</span><strong>21 hari</strong></div></div>
            <div className="oil-actions">{oilActive?<><button>Periksa minyak</button><button>Catat top-up</button></>:<button className="oil-start" onClick={()=>setOilModal(true)}>Mulai siklus minyak</button>}</div>
          </div>
        </section>
        <section className="panel recent-batches">
          <div className="panel-head"><div><h2>Produksi hari ini</h2><p>{batches.length} batch tercatat</p></div><button>Riwayat lengkap</button></div>
          <table><thead><tr><th>Waktu</th><th>Batch</th><th>Ayam mentah</th><th>Hasil</th><th>Operator</th><th>Status</th></tr></thead><tbody>
            {batches.map(row=><tr key={row.batch}><td>{row.time}</td><td>{row.batch}</td><td>{row.input}</td><td>{row.result}</td><td>{row.operator}</td><td><span className={row.status==="Sesuai"?"status success":"status warning"}>{row.status}</span></td></tr>)}
          </tbody></table>
        </section>
      </main>
      {done && <Modal close={()=>setDone(null)}><div className="success-modal"><span><Check/></span><h2>Batch {done.batch} selesai</h2><p>Bahan baku berkurang dan hasil produksi langsung masuk ke stok etalase.</p><div><strong>+{done.total} unit</strong><small>{packs} {menu.inputUnit} {menu.inputName.toLowerCase()}</small></div><button onClick={()=>setDone(null)}>Kembali ke produksi</button></div></Modal>}
      {outputModal&&<ProductionOutputModal mode={outputModal.mode} initial={outputs.find(item=>item.id===outputModal.id)} close={()=>setOutputModal(null)} save={value=>{setOutputs(current=>outputModal.mode==="edit"?current.map(item=>item.id===outputModal.id?{...item,...value}:item):[...current,{...value,id:crypto.randomUUID(),menuId:activeMenu,stock:0}]);setOutputModal(null)}}/>}
      {menuModal&&<ProductionMenuModal mode={menuModal.mode} initial={productionMenus.find(item=>item.id===menuModal.id)} close={()=>setMenuModal(null)} save={value=>{if(menuModal.mode==="edit"){setProductionMenus(current=>current.map(item=>item.id===menuModal.id?{...item,...value}:item))}else{const id=crypto.randomUUID();setProductionMenus(current=>[...current,{...value,id}]);setActiveMenu(id)}setMenuModal(null)}}/>}
      {oilModal && <Modal close={()=>setOilModal(false)}><div className="modal-head"><div><span className="modal-icon">💧</span><div><h2>Mulai siklus minyak</h2><p>Catat pengisian awal atau pergantian minyak.</p></div></div><button onClick={()=>setOilModal(false)}><X/></button></div><div className="crud-form"><label>Tanggal pengisian<input type="date" defaultValue="2026-07-23"/></label><div><label>Jumlah pouch<input type="number" defaultValue="7"/></label><label>Total liter<input type="number" defaultValue="14"/></label></div><label>Jenis aktivitas<select><option>Pengisian awal</option><option>Pergantian minyak</option></select></label><button onClick={()=>{setOilActive(true);setOilModal(false)}}>Mulai siklus dari nol</button></div></Modal>}
    </>
  );
}

function ProductionOutputModal({mode,initial,close,save}:{mode:"add"|"edit";initial?:{name:string;qty:number;unit:string};close:()=>void;save:(value:{name:string;qty:number;unit:string})=>void}) {
  return <Modal close={close}><div className="modal-head"><div><span className="modal-icon"><CookingPot/></span><div><h2>{mode==="edit"?"Edit":"Tambah"} hasil produksi</h2><p>Atur hasil yang masuk ke stok setiap batch selesai.</p></div></div><button onClick={close}><X/></button></div><form className="crud-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);save({name:String(form.get("name")),qty:Number(form.get("qty")||1),unit:String(form.get("unit"))})}}><label>Nama hasil<input name="name" required defaultValue={initial?.name} placeholder="Contoh: Kulit crispy"/></label><div><label>Jumlah per input<input name="qty" required min="0.001" step="0.001" type="number" defaultValue={initial?.qty??1}/></label><label>Satuan<select name="unit" defaultValue={initial?.unit??"pcs"}><option>pcs</option><option>porsi</option><option>gram</option><option>liter</option></select></label></div><button type="submit">Simpan hasil produksi</button></form></Modal>;
}

function ProductionMenuModal({mode,initial,close,save}:{mode:"add"|"edit";initial?:{name:string;inputName:string;inputUnit:string};close:()=>void;save:(value:{name:string;inputName:string;inputUnit:string})=>void}) {
  return <Modal close={close}><div className="modal-head"><div><span className="modal-icon"><CookingPot/></span><div><h2>{mode==="edit"?"Edit":"Tambah"} menu produksi</h2><p>Buat jenis proses produksi dan bahan baku utamanya.</p></div></div><button onClick={close}><X/></button></div><form className="crud-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);save({name:String(form.get("name")),inputName:String(form.get("inputName")),inputUnit:String(form.get("inputUnit"))})}}><label>Nama menu produksi<input name="name" required defaultValue={initial?.name} placeholder="Contoh: Goreng kulit"/></label><div><label>Bahan baku utama<input name="inputName" required defaultValue={initial?.inputName} placeholder="Contoh: Kulit mentah"/></label><label>Satuan input<select name="inputUnit" defaultValue={initial?.inputUnit??"pak"}><option>pak</option><option>kg</option><option>pouch</option><option>liter</option></select></label></div><button type="submit">Simpan menu produksi</button></form></Modal>;
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
  useEffect(()=>{listInventory().then(items=>{if(items.length)setRows(items.map(item=>[item.name,item.kind,`${item.stockQuantity} ${item.purchaseUnit}`,`Minimum ${item.minimumStock}`,item.stockQuantity<=item.minimumStock?"low":"good"]))}).catch(()=>undefined)},[]);
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
    {stockModal && <Modal close={()=>setStockModal(false)}>
      <div className="modal-head"><div><span className="modal-icon"><Boxes/></span><div><h2>Tambah bahan</h2><p>Atur identitas, satuan, konversi, dan batas stok.</p></div></div><button onClick={()=>setStockModal(false)}><X/></button></div>
      <form className="crud-form stock-crud" onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);const stock=Number(form.get("stockQuantity")||0);await createInventoryItem({name:stockName,sku:String(form.get("sku")||""),kind:String(form.get("kind")) as "raw_material",supplierName:String(form.get("supplierName")||""),purchasePrice:form.get("purchasePrice")?Number(form.get("purchasePrice")):undefined,purchaseUnit:String(form.get("purchaseUnit")),usageUnit:String(form.get("usageUnit")),unitsPerPurchase:Number(form.get("unitsPerPurchase")||1),stockQuantity:stock,minimumStock:Number(form.get("minimumStock")||0),shelfLifeDays:form.get("shelfLifeDays")?Number(form.get("shelfLifeDays")):undefined,storageLocation:String(form.get("storageLocation")||""),stockAlertEnabled:form.get("stockAlertEnabled")==="on",allowNegativeStock:form.get("allowNegativeStock")==="on"});setRows(old=>[[stockName,"Bahan baku",`${stock} ${String(form.get("purchaseUnit"))}`,"Item baru",stock<=Number(form.get("minimumStock")||0)?"low":"good"],...old]);setStockName("");setStockModal(false)}}>
        <div><label>Nama bahan<input required value={stockName} onChange={e=>setStockName(e.target.value)} placeholder="Contoh: Ayam mentah"/></label><label>Kode/SKU <small>Opsional</small><input name="sku" placeholder="BHN-001"/></label></div>
        <div><label>Kelompok<select name="kind"><option value="raw_material">Bahan baku</option><option value="production_output">Hasil produksi</option><option value="sales_supply">Pendamping</option><option value="direct_sale">Barang langsung jual</option></select></label><label>Supplier <small>Opsional</small><input name="supplierName" placeholder="Pilih atau tulis supplier"/></label></div>
        <div><label>Harga beli <small>Opsional</small><div className="price-input"><span>Rp</span><input name="purchasePrice" type="number" placeholder="0"/></div></label><label>Satuan beli<select name="purchaseUnit"><option>pak</option><option>pouch</option><option>karton</option><option>karung</option><option>kg</option></select></label></div>
        <div><label>Satuan pemakaian/jual<select name="usageUnit"><option>pcs</option><option>gram</option><option>ml</option><option>liter</option><option>porsi</option></select></label><label>Isi per satuan beli<input name="unitsPerPurchase" type="number" step="0.001" defaultValue="1" placeholder="Contoh: 9"/></label></div>
        <div><label>Stok awal<input name="stockQuantity" type="number" step="0.001" defaultValue="0"/></label><label>Stok minimum<input name="minimumStock" type="number" step="0.001" defaultValue="0"/></label></div>
        <div><label>Masa simpan <small>Opsional</small><div className="inline-unit"><input name="shelfLifeDays" type="number" placeholder="0"/><select><option>hari</option><option>minggu</option><option>bulan</option></select></div></label><label>Lokasi penyimpanan <small>Opsional</small><input name="storageLocation" placeholder="Gudang / freezer"/></label></div>
        <div className="item-options"><label><input name="stockAlertEnabled" type="checkbox" defaultChecked/>Aktifkan peringatan stok minimum</label><label><input name="allowNegativeStock" type="checkbox"/>Izinkan stok negatif untuk bahan ini</label></div>
        <button type="submit">Simpan bahan</button>
      </form>
    </Modal>}
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
  const tabs = ["Penjualan","Produk","Produksi","Persediaan","Kas"];
  const [tab,setTab]=useState("Penjualan");
  const [period,setPeriod]=useState("Hari ini");
  const reportData: Record<string,{kpis:string[][]; columns:string[]; rows:string[][]}> = {
    Penjualan:{kpis:[["Penjualan bersih","Rp2.480.000","+12,4% dari periode lalu"],["Jumlah transaksi","86","+8 transaksi"],["Rata-rata transaksi","Rp28.837","+3,1%"],["Item terjual","174","2,02 item/transaksi"]],columns:["Jam","Transaksi","Tunai","QRIS","Total"],rows:[["08:00–10:00","18","Rp186.000","Rp302.000","Rp488.000"],["10:00–12:00","25","Rp240.000","Rp478.000","Rp718.000"],["12:00–14:00","31","Rp310.000","Rp654.000","Rp964.000"],["14:00–16:00","12","Rp90.000","Rp220.000","Rp310.000"]]},
    Produk:{kpis:[["Menu terjual","174 item","+14 item"],["Menu terlaris","Paket Ayam Nasi","46 item"],["Bagian favorit","Dada","42 potong"],["Menu nonaktif","2 menu","Stok komponen habis"]],columns:["Menu","Kategori","Terjual","Omzet","Kontribusi"],rows:[["Paket Ayam Nasi","Paket","46","Rp874.000","35,2%"],["Ayam Crispy","Ayam","32","Rp416.000","16,8%"],["Rice Bowl","Rice bowl","24","Rp384.000","15,5%"],["Paket Berdua","Paket","18","Rp648.000","26,1%"]]},
    Produksi:{kpis:[["Batch hari ini","5 batch","10 pak ayam"],["Hasil produksi","89 potong","Standar 90"],["Efisiensi","98,9%","Susut 1 potong"],["Tepung terpakai","3,33 pak","Sesuai rasio"]],columns:["Batch","Waktu","Bahan","Hasil","Operator"],rows:[["#B-025","13:42","2 pak ayam","18 potong","Dina"],["#B-024","11:18","2 pak ayam","18 potong","Raka"],["#B-023","09:35","2 pak ayam","17 potong","Dina"],["#B-022","08:20","2 pak ayam","18 potong","Dina"]]},
    Persediaan:{kpis:[["Total item","28 item","25 aman"],["Stok menipis","3 item","Perlu restock"],["Nilai stok","Rp4.820.000","Estimasi saat ini"],["Selisih opname","-2 pcs","Kemasan ayam"]],columns:["Item","Kelompok","Stok","Minimum","Status"],rows:[["Ayam mentah","Bahan baku","12 pak","4 pak","Aman"],["Tepung bumbu","Bahan baku","1,3 pak","2 pak","Menipis"],["Minyak goreng","Bahan baku","9 pouch","4 pouch","Aman"],["Saus sachet","Pendamping","38 pcs","40 pcs","Menipis"]]},
    Kas:{kpis:[["Saldo drawer","Rp726.000","Termasuk modal"],["Penjualan tunai","Rp826.000","34 transaksi"],["Penjualan QRIS","Rp1.654.000","52 transaksi"],["Cash in/out","-Rp50.000","3 aktivitas"]],columns:["Waktu","Aktivitas","Metode","Nominal","Operator"],rows:[["12:46","Belanja outlet","Cash-out","-Rp50.000","Dina"],["09:15","Tambah kembalian","Cash-in","+Rp100.000","Dina"],["08:30","Cash drop","Cash-out","-Rp100.000","Dina"],["08:02","Buka shift","Modal awal","Rp350.000","Dina"]]},
  };
  const data=reportData[tab];
  return <>
    <Topbar title="Laporan" subtitle="Analisa penjualan, produksi, dan operasional outlet."/>
    <main className="content report-page">
      <section className="period-bar"><div>{["Hari ini","Kemarin","Minggu ini","Bulan ini","All time"].map(item=><button key={item} className={period===item?"active":""} onClick={()=>setPeriod(item)}>{item}</button>)}</div><button className="custom-period"><Clock3/> Periode khusus</button></section>
      <section className="report-tabs">{tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</section>
      <section className="report-kpis">{data.kpis.map(k=><div key={k[0]}><span>{k[0]}</span><strong>{k[1]}</strong><small>{k[2]}</small></div>)}</section>
      {tab==="Penjualan" && <section className="two-col report-charts"><div className="panel"><div className="panel-head"><div><h2>Tren penjualan</h2><p>Omzet dan jumlah transaksi · {period}</p></div></div><div className="line-chart"><svg viewBox="0 0 600 170" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--red)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--red)" stopOpacity="0"/></linearGradient></defs><path d="M0,145 C60,140 65,110 120,118 S185,82 240,94 S300,38 360,61 S430,26 480,48 S545,40 600,18 L600,170 L0,170Z" fill="url(#fill)"/><path d="M0,145 C60,140 65,110 120,118 S185,82 240,94 S300,38 360,61 S430,26 480,48 S545,40 600,18" fill="none" stroke="var(--red)" strokeWidth="4"/></svg><div>{["08","09","10","11","12","13","14","15"].map(x=><span key={x}>{x}:00</span>)}</div></div></div><div className="panel"><div className="panel-head"><div><h2>Menu terlaris</h2><p>Berdasarkan jumlah item</p></div></div>{[["Paket Ayam Nasi",46,100],["Ayam Crispy",32,70],["Rice Bowl",24,52],["Paket Berdua",18,39]].map((r,i)=><div className="rank-row" key={r[0]}><b>{i+1}</b><div><span>{r[0]}<strong>{r[1]} item</strong></span><i><em style={{width:`${r[2]}%`}}/></i></div></div>)}</div></section>}
      <section className="panel report-detail"><div className="panel-head"><div><h2>Detail {tab.toLowerCase()}</h2><p>Data dummy · {period}</p></div><button>Unduh CSV</button></div><table><thead><tr>{data.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{data.rows.map((row,i)=><tr key={i}>{row.map(cell=><td key={cell}>{cell}</td>)}</tr>)}</tbody></table></section>
    </main>
  </>;
}

function ActivityLog() {
  const events=[["14:24","Dina","Menyelesaikan transaksi #A-086","Tunai · Rp42.000"],["13:42","Dina","Memulai produksi batch #B-025","2 pak ayam · 18 potong"],["12:46","Dina","Mencatat cash-out","Belanja outlet · Rp50.000"],["11:18","Raka","Mengoreksi hasil produksi #B-024","Disetujui PIN owner"],["10:05","Dina","Konversi stok","2 sayap → 2 topping rice bowl"],["09:15","Dina","Mencatat cash-in","Uang kembalian · Rp100.000"]];
  return <><Topbar title="Riwayat aktivitas" subtitle="Jejak lengkap perubahan dan aktivitas operator."/><main className="content"><section className="panel"><div className="log-toolbar"><div className="categories"><button className="active">Semua</button><button>Kasir</button><button>Produksi</button><button>Stok</button><button>Kas</button><button>Approval owner</button></div><label><Search/><input placeholder="Cari aktivitas..."/></label></div><div className="timeline">{events.map((e,i)=><div className="timeline-row" key={e[0]+e[2]}><span className={`timeline-dot t${i%4}`}/><time>{e[0]}</time><div className="avatar small">{e[1].slice(0,2).toUpperCase()}</div><p><strong>{e[1]}</strong><span>{e[2]}</span><small>{e[3]}</small></p><button>Detail</button></div>)}</div></section></main></>;
}

function SettingsPage({ business, setBusiness, onSave }: { business: BusinessProfile; setBusiness: (business:BusinessProfile)=>void; onSave:()=>Promise<void> }) {
  const [autoPrint,setAutoPrint]=useState(true);
  const [kitchenPrint,setKitchenPrint]=useState(false);
  const [saveState,setSaveState]=useState<"idle"|"saving"|"saved">("idle");
  const tabs=["Profil bisnis","Kasir & printer","Outlet","Default & lanjutan","PIN owner","Operator"];
  const [tab,setTab]=useState("Profil bisnis");
  return <>
    <Topbar title="Pengaturan" subtitle="Atur profil bisnis, kasir, dan operasional outlet."/>
    <main className="content settings-page">
      <aside className="settings-nav">{tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</aside>
      <section className="panel settings-content">
        {tab==="Profil bisnis" && <><div className="settings-title"><h2>Profil bisnis</h2><p>Identitas ini digunakan di aplikasi dan struk.</p></div><div className="business-fields"><label>Nama bisnis<input value={business.name} onChange={e=>setBusiness({...business,name:e.target.value})}/></label><label>Nama outlet<input value={business.outlet} onChange={e=>setBusiness({...business,outlet:e.target.value})}/></label><label>Tagline<input value={business.tagline} onChange={e=>setBusiness({...business,tagline:e.target.value})}/></label><label>Warna utama<div className="color-field"><input type="color" value={business.primaryColor} onChange={e=>setBusiness({...business,primaryColor:e.target.value})}/><input value={business.primaryColor} onChange={e=>setBusiness({...business,primaryColor:e.target.value})}/></div></label><label>Warna sidebar<div className="color-field"><input type="color" value={business.sidebarColor} onChange={e=>setBusiness({...business,sidebarColor:e.target.value})}/><input value={business.sidebarColor} onChange={e=>setBusiness({...business,sidebarColor:e.target.value})}/></div></label></div></>}
        {tab==="Kasir & printer" && <><div className="settings-title"><h2>Kasir & printer</h2><p>Konfigurasi pembayaran dan pencetakan struk.</p></div><div className="setting-row"><div><strong>Cetak struk otomatis</strong><span>Struk langsung dicetak setelah pembayaran berhasil.</span></div><button className={`switch ${autoPrint?"on":""}`} onClick={()=>setAutoPrint(!autoPrint)}><i/></button></div><div className="setting-row"><div><strong>Cetak tiket dapur</strong><span>Kirim tiket pesanan ke printer produksi.</span></div><button className={`switch ${kitchenPrint?"on":""}`} onClick={()=>setKitchenPrint(!kitchenPrint)}><i/></button></div><div className="setting-field"><label>Ukuran kertas</label><select defaultValue="58"><option value="58">Thermal 58 mm</option><option value="80">Thermal 80 mm</option></select></div><div className="setting-field"><label>Printer struk</label><select><option>Printer kasir utama</option><option>Belum terhubung</option></select></div><div className="receipt-preview"><span>PRATINJAU STRUK</span><div><b>{business.name.toUpperCase()}</b><small>{business.outlet} · Pesanan #A-087</small><hr/><p>1x Paket Ayam Nasi <em>Rp19.000</em></p><p>1x Ayam Crispy <em>Rp13.000</em></p><hr/><strong>TOTAL <em>Rp32.000</em></strong><small>Terima kasih!</small></div></div></>}
        {tab==="Outlet" && <><div className="settings-title"><h2>Outlet</h2><p>Informasi operasional outlet aktif.</p></div><div className="business-fields"><label>Nama outlet<input defaultValue="Outlet Utama"/></label><label>Telepon<input defaultValue="0812 3456 7890"/></label><label>Alamat<input defaultValue="Jl. Contoh Raya No. 18"/></label><label>Zona waktu<select defaultValue="wib"><option value="wib">WIB · Asia/Jakarta</option></select></label><label>Jam buka<input type="time" defaultValue="08:00"/></label><label>Jam tutup<input type="time" defaultValue="21:00"/></label></div><div className="setting-row"><div><strong>Mode satu outlet</strong><span>Semua transaksi dan stok berada di outlet ini.</span></div><button className="switch on"><i/></button></div></>}
        {tab==="Default & lanjutan" && <><div className="settings-title"><h2>Default & aturan lanjutan</h2><p>Nilai opsional untuk item baru. Setiap bahan dan resep dapat memakai aturan khusus.</p></div><div className="advanced-banner"><Settings/><div><strong>Tidak wajib diisi</strong><span>Pengaturan ini hanya menjadi nilai awal ketika membuat bahan atau proses produksi baru.</span></div></div><div className="setting-field"><label>Ukuran batch awal</label><select><option>2 pak ayam</option><option>Tanpa default</option></select></div><div className="setting-field"><label>Metode penggunaan batch</label><select><option>FIFO · batch tertua dahulu</option><option>Manual</option></select></div><div className="setting-field"><label>Jadwal pengingat opname</label><select><option>Setiap tutup outlet</option><option>Mingguan</option><option>Nonaktif</option></select></div><div className="setting-row"><div><strong>Cegah stok negatif secara default</strong><span>Dapat dioverride pada masing-masing bahan.</span></div><button className="switch on"><i/></button></div><div className="setting-row"><div><strong>Peringatan stok minimum default</strong><span>Dapat dinonaktifkan pada bahan tertentu.</span></div><button className="switch on"><i/></button></div><h3 className="setting-subtitle">Aturan alat deep fryer</h3><div className="setting-field"><label>Pengingat top-up</label><input defaultValue="Setiap 10 pak ayam"/></div><div className="setting-field"><label>Batas pergantian</label><input defaultValue="200 pak atau 21 hari"/></div></>}
        {tab==="PIN owner" && <><div className="settings-title"><h2>PIN owner</h2><p>Kontrol tindakan sensitif dan approval.</p></div><div className="owner-pin-card"><ShieldCheck/><div><strong>PIN owner aktif</strong><span>Terakhir diubah 12 Juli 2026</span></div><button>Ubah PIN</button></div><h3 className="setting-subtitle">Wajib approval untuk</h3>{["Refund dan pembatalan transaksi","Selisih close kasir di atas Rp10.000","Cash-out di atas Rp200.000","Koreksi stok dan hasil produksi","Produksi saat minyak melewati batas"].map(item=><label className="approval-rule" key={item}><input type="checkbox" defaultChecked/><span>{item}</span></label>)}</>}
        {tab==="Operator" && <><div className="settings-title"><h2>Operator</h2><p>Identitas staf untuk pencatatan aktivitas.</p></div><div className="operator-list">{[["DN","Dina","Aktif · Shift pagi"],["RK","Raka","Aktif · Shift siang"],["AY","Ayu","Tidak sedang shift"]].map(o=><div key={o[1]}><div className="avatar">{o[0]}</div><p><strong>{o[1]}</strong><span>{o[2]}</span></p><button>Kelola</button></div>)}</div><button className="add-operator"><Plus/> Tambah operator</button></>}
        <button className="save-settings" onClick={async()=>{setSaveState("saving");await onSave();setSaveState("saved");setTimeout(()=>setSaveState("idle"),1600)}}>{saveState==="saving"?"Menyimpan...":saveState==="saved"?"Tersimpan ✓":"Simpan pengaturan"}</button>
      </section>
    </main>
  </>;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [business,setBusiness]=useState(defaultBusiness);
  const [collapsed,setCollapsed]=useState(false);
  useEffect(()=>{loadBusinessProfile(defaultBusiness).then(setBusiness).catch(()=>undefined)},[]);
  return (
    <div className={`app-shell ${collapsed?"sidebar-is-collapsed":""}`} style={{"--red":business.primaryColor,"--red-dark":business.primaryColor} as CSSProperties}>
      <Sidebar view={view} setView={setView} business={business} collapsed={collapsed} setCollapsed={setCollapsed} />
      <section className="workspace">
        {view === "dashboard" && <Dashboard setView={setView}/>}
        {view === "kasir" && <POS/>}
        {view === "menu" && <MenuManagement/>}
        {view === "produksi" && <Production/>}
        {view === "stok" && <Inventory/>}
        {view === "drawer" && <Drawer/>}
        {view === "laporan" && <Reports/>}
        {view === "riwayat" && <ActivityLog/>}
        {view === "pengaturan" && <SettingsPage business={business} setBusiness={setBusiness} onSave={async()=>{await saveBusinessProfile(business)}}/>}
      </section>
    </div>
  );
}
