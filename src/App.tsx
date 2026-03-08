import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  CreditCard, 
  History, 
  Settings, 
  TrendingUp, 
  Users, 
  User,
  ShieldCheck, 
  ShieldAlert,
  ArrowUpRight,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ArrowLeft,
  Download,
  Share2,
  AlertCircle,
  AlertTriangle,
  Menu,
  X,
  RotateCcw,
  Info,
  Terminal,
  Activity,
  Zap,
  UserPlus,
  Edit,
  Trash2,
  Camera,
  Upload,
  Palette,
  Monitor,
  Image,
  FileText,
  Calendar,
  Filter,
  RefreshCcw,
  MoreVertical,
  ChevronDown,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Clock,
  Building2,
  Key,
  Copy,
  Wallet,
  BookOpen,
  Plus,
  Trash,
  Check,
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { cn, formatCurrency } from "./lib/utils";
import { Toaster, toast } from "sonner";
import { saveTransactions, getLocalTransactions, queueAction, getSyncQueue, removeSyncAction } from "./db";

// --- Theme Management ---
const ThemeContext = React.createContext({
  theme: 'dark',
  setTheme: (theme: string) => {}
});

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

// --- PDF Generation ---
const generateReceipt = (data: any) => {
  const doc = new jsPDF();
  const logoUrl = localStorage.getItem('siteLogo') || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s';
  
  // Header
  doc.setFillColor(226, 19, 110); // bKash Pink
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Receipt", 105, 25, { align: "center" });
  
  // Content
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  
  const startY = 60;
  const lineGap = 10;
  
  doc.text(`Transaction ID: ${data.trxID}`, 20, startY);
  doc.text(`Amount: BDT ${data.amount}`, 20, startY + lineGap);
  doc.text(`Customer: ${data.customer}`, 20, startY + lineGap * 2);
  doc.text(`Invoice: ${data.invoice}`, 20, startY + lineGap * 3);
  doc.text(`Date: ${new Date(data.time).toLocaleString()}`, 20, startY + lineGap * 4);
  doc.text(`Status: Completed`, 20, startY + lineGap * 5);
  
  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 150, 190, 150);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Thank you for using bKash Enterprise Payment Gateway", 105, 160, { align: "center" });
  doc.text("This is an electronically generated receipt.", 105, 165, { align: "center" });
  
  doc.save(`Receipt-${data.trxID}.pdf`);
};

const generateStatementPDF = (transactions: any[], from: string, to: string) => {
  const doc = new jsPDF();
  
  doc.setFillColor(226, 19, 110);
  doc.rect(0, 0, 210, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Transaction Statement", 105, 20, { align: "center" });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Period: ${from} to ${to}`, 14, 40);
  
  const tableData = transactions.map(t => [
    new Date(t.created_at).toLocaleDateString(),
    t.trx_id,
    t.customer_msisdn,
    t.merchant_invoice,
    `BDT ${t.amount.toFixed(2)}`
  ]);
  
  (doc as any).autoTable({
    startY: 45,
    head: [['Date', 'Trx ID', 'Customer', 'Invoice', 'Amount']],
    body: tableData,
    headStyles: { fillColor: [226, 19, 110] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });
  
  doc.save(`Statement-${from}-to-${to}.pdf`);
};

// --- Types ---
interface Transaction {
  id: string;
  payment_id: string;
  trx_id: string;
  amount: number;
  status: string;
  customer_msisdn: string;
  merchant_invoice: string;
  payment_mode?: string;
  created_at: string;
}

interface Stats {
  totalVolume: number;
  successCount: number;
  failedCount: number;
  totalCount: number;
  recentTransactions: Transaction[];
  userActivity: any[];
}

interface Refund {
  id: string;
  refund_id: string;
  original_trx_id: string;
  original_payment_id: string;
  amount: number;
  refund_amount: number;
  status: string;
  reason: string;
  sku: string;
  refund_execution_time: string;
  response_data: string;
  ip_address: string;
  initiated_by: string;
  created_at: string;
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-bkash/10 text-bkash" 
        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-bkash-dark hover:text-zinc-900 dark:hover:text-white"
    )}
  >
    <Icon size={20} className={cn("transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
    <span className="font-medium">{label}</span>
    {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-bkash" />}
  </button>
);

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-bkash-dark/50 border border-zinc-200 dark:border-bkash-dark p-6 rounded-3xl backdrop-blur-sm shadow-sm dark:shadow-none"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl", color || "bg-bkash/10 text-bkash")}>
        <Icon size={24} className={color ? "text-white" : ""} />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
          trend > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <h4 className="text-zinc-500 dark:text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">{title}</h4>
    <p className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">{value}</p>
  </motion.div>
);

const TransactionRow = ({ tx }: { tx: Transaction, key?: string }) => (
  <tr className="group border-b border-bkash-dark/50 hover:bg-bkash-dark/30 transition-colors">
    <td className="py-4 px-4">
      <div className="flex flex-col">
        <span className="text-white font-medium text-sm">{tx.merchant_invoice || "N/A"}</span>
        <span className="text-zinc-500 text-xs font-mono">{tx.payment_id}</span>
      </div>
    </td>
    <td className="py-4 px-4">
      <span className="text-zinc-300 text-sm">{tx.customer_msisdn || "Pending"}</span>
    </td>
    <td className="py-4 px-4">
      <span className="text-white font-bold text-sm">{formatCurrency(tx.amount)}</span>
    </td>
    <td className="py-4 px-4">
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize",
        tx.status === 'completed' ? "bg-bkash/10 text-bkash" : 
        tx.status === 'refunded' ? "bg-rose-500/10 text-rose-500" :
        tx.status === 'initiated' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
      )}>
        {tx.status === 'completed' ? <CheckCircle2 size={12} /> : 
         tx.status === 'refunded' ? <RotateCcw size={12} /> :
         tx.status === 'initiated' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
        {tx.status}
      </span>
    </td>
    <td className="py-4 px-4 text-right">
      <div className="flex justify-end items-center gap-2">
        <span className="text-zinc-500 text-xs">{new Date(tx.created_at).toLocaleString()}</span>
        {tx.status === 'completed' && tx.payment_mode !== 'GLOBAL' && (
          <Link 
            to={`/admin/refunds?trx_id=${tx.trx_id}`}
            className="p-1.5 text-zinc-500 hover:text-bkash transition-colors"
            title="Refund"
          >
            <RotateCcw size={14} />
          </Link>
        )}
        {tx.payment_mode === 'GLOBAL' && tx.status === 'completed' && (
          <span className="p-1.5 text-zinc-700 cursor-not-allowed" title="Global API - Non-refundable by Admin">
            <Lock size={14} />
          </span>
        )}
      </div>
    </td>
  </tr>
);

// --- Pages ---

const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const merchantId = localStorage.getItem("merchant_id");
    const url = merchantId ? `/api/admin/stats?merchantId=${merchantId}` : "/api/admin/stats";
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then(setStats)
      .catch(err => console.error("Stats Fetch Error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-bkash" size={40} /></div>;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Total Volume" value={formatCurrency(stats?.totalVolume || 0)} icon={TrendingUp} trend={12.5} color="bg-bkash" />
        <StatCard title="Success Payments" value={stats?.successCount || 0} icon={CheckCircle2} trend={8.2} color="bg-emerald-600" />
        <StatCard title="Failed Payments" value={stats?.failedCount || 0} icon={XCircle} trend={-1.4} color="bg-rose-600" />
        <StatCard title="Total Transactions" value={stats?.totalCount || 0} icon={Activity} color="bg-zinc-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-bkash-dark/50 border border-bkash-dark rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-6">Revenue Growth</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'Mon', value: 4000 }, { name: 'Tue', value: 3000 }, { name: 'Wed', value: 5000 },
                { name: 'Thu', value: 2780 }, { name: 'Fri', value: 1890 }, { name: 'Sat', value: 2390 }, { name: 'Sun', value: 3490 },
              ]}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-6">Payment Methods</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'bKash', value: 75 }, { name: 'Cards', value: 15 }, { name: 'Other', value: 10 }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    <Cell fill="#10b981" /><Cell fill="#3b82f6" /><Cell fill="#a855f7" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Activity size={18} className="text-bkash" />
              User Activity
            </h3>
            <div className="space-y-4">
              {stats?.userActivity?.map((log, i) => (
                <div key={i} className="border-l-2 border-bkash/30 pl-3 py-1">
                  <p className="text-xs font-bold text-zinc-300">{log.action}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{log.details}</p>
                  <p className="text-[9px] text-zinc-600 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              ))}
              {(!stats?.userActivity || stats.userActivity.length === 0) && (
                <p className="text-xs text-zinc-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-bkash-dark flex justify-between items-center">
          <h3 className="font-bold text-lg">Recent Transactions</h3>
          <Link to="/admin/transactions" className="text-bkash text-sm font-medium hover:underline flex items-center gap-1">View all <ChevronRight size={16} /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bkash-dark/50 text-zinc-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice / ID</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentTransactions.map((tx: Transaction) => <TransactionRow key={tx.id} tx={tx} />)}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get("mid");
  const paramAmount = searchParams.get("amount");
  const paramInvoice = searchParams.get("invoice");
  
  const [amount, setAmount] = useState(paramAmount || "100");
  const [invoice, setInvoice] = useState(paramInvoice || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualRedirect, setShowManualRedirect] = useState(false);
  const [bkashURL, setBkashURL] = useState("");
  const isOnline = useOnlineStatus();

  const handleCheckout = async () => {
    if (!isOnline) {
      toast.error("You are offline. Please connect to the internet to make a payment.");
      return;
    }
    setIsProcessing(true);
    setShowManualRedirect(false);
    try {
      const res = await fetch("/api/bkash/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount, 
          invoice: invoice || `INV-${Date.now()}`, 
          merchantId 
        }),
      });
      const data = await res.json();
      if (data.bkashURL) {
        setBkashURL(data.bkashURL);
        toast.success("Payment initiated! Redirecting...");
        console.log("Redirecting to bKash:", data.bkashURL);
        
        const isIframe = window.self !== window.top;
        
        if (isIframe) {
          const win = window.open(data.bkashURL, '_blank');
          if (!win) {
            setShowManualRedirect(true);
          }
        } else {
          window.location.href = data.bkashURL;
        }

        setTimeout(() => {
          setIsProcessing(false);
        }, 2000);
      } else {
        toast.error(data.error || "Payment initiation failed");
        setIsProcessing(false);
      }
    } catch (err) {
      toast.error("Something went wrong");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl">
        <div className="bg-bkash-dark border border-bkash-dark rounded-3xl overflow-hidden shadow-2xl">
          <div className="bg-bkash p-6 md:p-8 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl flex items-center justify-center p-2 shrink-0">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s" alt="bKash" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold">Secure Checkout</h3>
                <p className="opacity-80 text-xs md:text-sm mt-0.5">Enterprise Payment Gateway</p>
              </div>
            </div>
            <Link 
              to="/generate" 
              className="w-full sm:w-auto bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <Zap size={18} /> Create Link
            </Link>
            <Link 
              to="/admin/login" 
              className="w-full sm:w-auto bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} /> Admin Panel
            </Link>
          </div>
          <div className="p-6 md:p-8 space-y-6 md:space-y-8">
            <div className="space-y-3 md:space-y-4">
              <label className="block text-xs md:text-sm font-medium text-zinc-400">Payment Amount (BDT)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl md:text-2xl font-bold text-zinc-500">৳</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-bkash-dark/50 border-2 border-bkash-dark rounded-2xl py-3 md:py-4 pl-10 pr-4 text-2xl md:text-3xl font-bold text-white focus:border-bkash focus:outline-none transition-all" />
              </div>
            </div>
            <button 
              onClick={handleCheckout} 
              disabled={isProcessing || !isOnline} 
              className={cn(
                "w-full font-bold py-4 md:py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-base md:text-lg",
                isOnline 
                  ? "bg-bkash hover:bg-bkash/90 text-white shadow-bkash/20" 
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
              )}
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : (
                isOnline ? <>Pay with bKash <ExternalLink size={20} /></> : <>Offline: Connect to Pay <ShieldCheck size={20} /></>
              )}
            </button>

            {showManualRedirect && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-amber-200/80">
                    Redirect blocked by browser security. Please click the button below to open the payment page in a new tab.
                  </p>
                </div>
                <a 
                  href={bkashURL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  Open bKash Payment <ExternalLink size={16} />
                </a>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PaymentLinkGenerator = () => {
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleGenerate = () => {
    if (!amount) {
      toast.error("Please enter an amount");
      return;
    }
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    params.set("amount", amount);
    if (invoice) params.set("invoice", invoice);
    if (merchantId) params.set("mid", merchantId);
    
    const link = `${baseUrl}/?${params.toString()}`;
    setGeneratedLink(link);
    toast.success("Payment link generated!");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setIsCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'bKash Payment Link',
          text: `Pay ৳${amount} via bKash`,
          url: generatedLink,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
        <div className="bg-bkash-dark border border-bkash-dark rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="bg-bkash p-8 text-white">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2">
                <Zap className="text-bkash" size={28} />
              </div>
              <h2 className="text-2xl font-black tracking-tight">Payment Link Generator</h2>
            </div>
            <p className="opacity-80 text-sm font-medium">Create a shareable link for your customers.</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Amount (BDT)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-zinc-500">৳</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-10 pr-4 text-xl font-bold text-white focus:border-bkash focus:outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Invoice (Optional)</label>
                <input 
                  type="text" 
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-4 text-sm font-medium text-white focus:border-bkash focus:outline-none transition-all"
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Merchant ID (Optional)</label>
              <input 
                type="text" 
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-4 text-sm font-medium text-white focus:border-bkash focus:outline-none transition-all"
                placeholder="Leave empty for Global API"
              />
            </div>

            <button 
              onClick={handleGenerate}
              className="w-full bg-bkash hover:bg-bkash/90 text-white font-black py-5 rounded-2xl shadow-xl shadow-bkash/20 transition-all flex items-center justify-center gap-3 text-lg"
            >
              Generate Link <Zap size={20} />
            </button>

            <AnimatePresence>
              {generatedLink && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-6 border-t border-zinc-800 space-y-4"
                >
                  <div className="bg-black border border-zinc-800 rounded-2xl p-4 break-all font-mono text-xs text-zinc-400">
                    {generatedLink}
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleCopy}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {isCopied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Share2 size={18} />}
                      {isCopied ? "Copied!" : "Copy Link"}
                    </button>
                    <button 
                      onClick={handleShare}
                      className="flex-1 bg-white text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={18} /> Share Link
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="pt-4 text-center">
              <Link to="/" className="text-zinc-500 hover:text-bkash text-sm font-medium transition-colors">
                &larr; Back to Checkout
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const trxID = searchParams.get("trxID");
  const amount = searchParams.get("amount");
  const customer = searchParams.get("customer");
  const invoice = searchParams.get("invoice");
  const time = searchParams.get("time");

  const formattedTime = time ? new Date(time).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }) : 'N/A';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="max-w-lg mx-auto pt-8"
    >
      <div className="bg-bkash-dark border border-bkash-dark rounded-[2rem] overflow-hidden shadow-2xl shadow-bkash/10">
        <div className="bg-bkash p-6 md:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
            className="relative z-10 w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"
          >
            <CheckCircle2 size={40} className="text-bkash" />
          </motion.div>
          <h2 className="relative z-10 text-xl md:text-2xl font-black text-white">Payment Successful</h2>
        </div>
        
        <div className="p-6 md:p-12 space-y-6 md:space-y-8">
          <div className="text-center">
            <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2">Amount Paid</p>
            <h3 className="text-3xl md:text-5xl font-black text-white">
              <span className="text-bkash mr-2">৳</span>
              {parseFloat(amount || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>

          <div className="space-y-4 pt-4 border-t border-bkash-dark">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1 gap-1">
              <span className="text-zinc-500 font-medium text-sm">Transaction ID</span>
              <span className="font-mono font-bold text-zinc-200 text-sm break-all">{trxID}</span>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1 gap-1">
              <span className="text-zinc-500 font-medium text-sm">Date & Time</span>
              <span className="font-bold text-zinc-200 text-sm">{formattedTime}</span>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1 gap-1">
              <span className="text-zinc-500 font-medium text-sm">Customer</span>
              <span className="font-bold text-zinc-200 text-sm">
                {customer ? `Customer ${customer.slice(-4)}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-500 font-medium">Invoice No</span>
              <span className="font-bold text-zinc-200">{invoice || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-500 font-medium">Payment Method</span>
              <span className="font-bold text-zinc-200">bKash Wallet</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-500 font-medium">Status</span>
              <span className="text-[#00C853] font-black uppercase tracking-wider text-sm">Completed</span>
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <Link 
              to="/" 
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ArrowLeft size={18} /> Pay Again
            </Link>
            <button 
              onClick={() => generateReceipt({ trxID, amount, customer, invoice, time })}
              className="flex-1 bg-bkash hover:bg-bkash/90 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 text-white shadow-lg shadow-bkash/20"
            >
              <Download size={18} /> Receipt
            </button>
          </div>
        </div>
        
        <div className="bg-zinc-950 p-6 text-center border-t border-zinc-800">
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">Thank you for your payment</p>
          <p className="text-zinc-700 text-[9px] mt-1">Receipt generated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </motion.div>
  );
};

const FailurePage = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error") || searchParams.get("status");

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto text-center space-y-8 pt-12">
      <div className="bg-bkash/10 border border-bkash/20 p-6 rounded-full inline-block">
        <XCircle size={80} className="text-bkash" />
      </div>
      <div>
        <h2 className="text-4xl font-black mb-2">Payment Failed</h2>
        <p className="text-zinc-400">We couldn't process your payment at this time.</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4 text-left">
        <AlertCircle className="text-bkash shrink-0" />
        <div>
          <p className="text-xs text-zinc-500 uppercase font-bold">Error Details</p>
          <p className="text-zinc-300">{error || "Unknown error occurred"}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/checkout" className="flex-1 bg-bkash hover:bg-bkash/90 py-4 rounded-xl font-bold transition-colors text-center">
          Try Again
        </Link>
        <Link to="/" className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-xl font-bold transition-colors text-center">
          Cancel
        </Link>
      </div>
    </motion.div>
  );
};

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

const SyncManager = () => {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOnline) {
      processQueue();
    }
  }, [isOnline]);

  const processQueue = async () => {
    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    toast.info(`Syncing ${queue.length} pending actions...`);

    for (const action of queue) {
      try {
        let res;
        if (action.type === 'refund') {
          res = await fetch("/api/bkash/refund", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
        } else if (action.type === 'settings') {
          res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
        }

        if (res && res.ok) {
          await removeSyncAction(action.id);
        }
      } catch (err) {
        console.error("Sync Error:", err);
      }
    }

    const remaining = await getSyncQueue();
    if (remaining.length === 0) {
      toast.success("Offline sync completed!");
    }
    setIsSyncing(false);
  };

  if (!isSyncing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200]">
      <div className="bg-zinc-900 border border-bkash/30 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl shadow-bkash/20">
        <Loader2 size={16} className="animate-spin text-bkash" />
        <span className="text-xs font-bold text-white">Syncing Data...</span>
      </div>
    </div>
  );
};

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    search: ""
  });
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      if (isOnline) {
        const merchantId = localStorage.getItem("merchant_id");
        const params = new URLSearchParams({
          ...filters,
          ...(merchantId ? { merchantId } : {})
        });
        const res = await fetch(`/api/admin/transactions?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch transactions");
        const data = await res.json();
        setTransactions(data);
        // Cache for offline use
        await saveTransactions(data);
      } else {
        // Load from local DB when offline
        const localData = await getLocalTransactions();
        // Simple client-side filtering for offline mode
        let filtered = localData;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          filtered = filtered.filter(tx => 
            (tx.trx_id?.toLowerCase().includes(s)) || 
            (tx.merchant_invoice?.toLowerCase().includes(s)) ||
            (tx.customer_msisdn?.toLowerCase().includes(s))
          );
        }
        setTransactions(filtered);
        toast.info("Showing offline cached data");
      }
    } catch (err) {
      console.error("Fetch Transactions Error:", err);
      // Fallback to local data on error
      const localData = await getLocalTransactions();
      setTransactions(localData);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    let csv = "Date,Transaction ID,Amount,Customer,Invoice,Payment ID\n";
    transactions.forEach(p => {
      csv += `${p.created_at},${p.trx_id},${p.amount},${p.customer_msisdn || ''},${p.merchant_invoice || ''},${p.payment_id || ''}\n`;
    });
    
    const blob = new Blob([csv], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'payments.csv';
    a.click();
  };

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Filters */}
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl p-5 md:p-6 backdrop-blur-sm">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <Search size={20} className="text-bkash" />
          Filter Payments
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">Start Date</label>
            <input 
              type="date" 
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">End Date</label>
            <input 
              type="date" 
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">Search</label>
            <input 
              type="text" 
              placeholder="TrxID, Invoice, Customer"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchTransactions}
              className="flex-1 bg-bkash hover:bg-bkash/90 text-white font-bold py-2 rounded-xl transition-all text-sm"
            >
              Filter
            </button>
            <button 
              onClick={() => {
                setFilters({ start_date: "", end_date: "", search: "" });
                setTimeout(fetchTransactions, 0);
              }}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl transition-all text-sm"
            >
              Reset
            </button>
            <button 
              onClick={handleExport}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-bkash rounded-xl transition-all shrink-0"
              title="Export CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-5 md:p-6 border-b border-bkash-dark flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-lg">Transaction List</h3>
          <div className="text-left sm:text-right">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Volume</p>
            <p className="text-xl font-black text-bkash">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-bkash-dark/50 text-zinc-500 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="py-4 px-6 font-black">Date / Time</th>
                <th className="py-4 px-6 font-black">Transaction ID</th>
                <th className="py-4 px-6 font-black">Amount</th>
                <th className="py-4 px-6 font-black">Customer</th>
                <th className="py-4 px-6 font-black">Status</th>
                <th className="py-4 px-6 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Loading...</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="group border-b border-bkash-dark/50 hover:bg-bkash-dark/30 transition-colors">
                  <td className="py-4 px-6 text-sm text-zinc-400">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="py-4 px-6 font-bold text-sm">{tx.trx_id || "PENDING"}</td>
                  <td className="py-4 px-6 font-bold text-sm text-bkash">{formatCurrency(tx.amount)}</td>
                  <td className="py-4 px-6 text-sm text-zinc-300">{tx.customer_msisdn || "N/A"}</td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      tx.status === 'completed' ? "bg-bkash/10 text-bkash" : 
                      tx.status === 'refunded' ? "bg-rose-500/10 text-rose-500" :
                      "bg-zinc-500/10 text-zinc-500"
                    )}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setSelectedTx(tx)}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                        title="View Details"
                      >
                        <Info size={18} />
                      </button>
                      {tx.status === 'completed' && (
                        <Link 
                          to={`/admin/refunds?trx_id=${tx.trx_id}`}
                          className="p-2 text-zinc-400 hover:text-bkash transition-colors"
                          title="Refund"
                        >
                          <RotateCcw size={18} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-zinc-500">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedTx(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-xl">Transaction Details</h3>
                <button onClick={() => setSelectedTx(null)} className="p-2 text-zinc-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Transaction ID</p>
                    <p className="font-bold text-bkash">{selectedTx.trx_id || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Payment ID</p>
                    <p className="text-sm font-mono">{selectedTx.payment_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Amount</p>
                    <p className="text-lg font-black">{formatCurrency(selectedTx.amount)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Status</p>
                    <span className="bg-bkash/10 text-bkash px-2 py-1 rounded-md text-[10px] font-bold uppercase">{selectedTx.status}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Customer</p>
                    <p className="text-sm">{selectedTx.customer_msisdn || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Invoice</p>
                    <p className="text-sm">{selectedTx.merchant_invoice || "N/A"}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase font-bold">Date / Time</p>
                  <p className="text-sm">{new Date(selectedTx.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex justify-end">
                <button onClick={() => setSelectedTx(null)} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const LogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/logs")
      .then(res => res.json())
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Terminal size={20} className="text-bkash" />
            System Debug Logs
          </h3>
          <button onClick={() => window.location.reload()} className="text-xs text-zinc-500 hover:text-white transition-colors">Refresh</button>
        </div>
        <div className="p-4 bg-black/50 font-mono text-xs space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="animate-spin inline-block" /></div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-zinc-600">No logs found</div>
          ) : logs.map((log, i) => (
            <div key={i} className="border-b border-zinc-800/50 pb-2 last:border-0">
              <div className="flex gap-4 text-zinc-500 mb-1">
                <span className="text-bkash font-bold">[{log.level || 'INFO'}]</span>
                <span>{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <p className="text-zinc-300">{log.message}</p>
              {log.details && (
                <pre className="mt-1 text-[10px] text-zinc-600 overflow-x-auto">
                  {log.details}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then(res => res.json())
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-zinc-800">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Activity size={20} className="text-bkash" />
            Security Audit Trail
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-zinc-500 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="py-4 px-6 font-black">Timestamp</th>
                <th className="py-4 px-6 font-black">Action</th>
                <th className="py-4 px-6 font-black">User</th>
                <th className="py-4 px-6 font-black">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center"><Loader2 className="animate-spin inline-block" /></td></tr>
              ) : logs.map((log, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="py-4 px-6 text-xs text-zinc-500">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-4 px-6"><span className="px-2 py-1 bg-bkash/10 text-bkash rounded text-[10px] font-bold uppercase">{log.action}</span></td>
                  <td className="py-4 px-6 text-sm font-medium">{log.user}</td>
                  <td className="py-4 px-6 text-xs text-zinc-400">{log.details}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-zinc-600">No audit logs recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

const SettingsPage = () => {
  const [settings, setSettings] = useState<any>({});
  const [merchantSettings, setMerchantSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();
  const { theme, setTheme } = useTheme();
  const userRole = localStorage.getItem("userRole");
  const merchantId = localStorage.getItem("merchant_id");

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    setIsUploadingLogo(true);
    try {
      const res = await fetch("/api/admin/settings/upload-logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSettings({ ...settings, SITE_LOGO: data.url });
        toast.success("Logo uploaded successfully");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/admin/test-bkash", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error?.statusMessage || "Connection failed");
      }
    } catch (err) {
      toast.error("Failed to reach server");
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (userRole === 'admin') {
          const res = await fetch("/api/admin/settings");
          const data = await res.json();
          setSettings(data);
        } else if (merchantId) {
          const res = await fetch(`/api/merchant/settings?merchantId=${merchantId}`);
          const data = await res.json();
          setMerchantSettings(data);
        }
      } catch (err) {
        toast.error("Failed to fetch settings");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userRole, merchantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (userRole === 'admin') {
        const res = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings)
        });
        if (res.ok) toast.success("Settings updated successfully");
      } else if (merchantId) {
        const res = await fetch("/api/merchant/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...merchantSettings, merchantId })
        });
        if (res.ok) toast.success("Merchant settings updated successfully");
      }
    } catch (err) {
      toast.error("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-bkash" size={40} /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="bg-zinc-800/50 p-8 border-b border-zinc-800">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="text-bkash" />
            System Configuration
          </h3>
          <p className="text-zinc-500 mt-1 font-medium">Manage your bKash API credentials and application settings.</p>
        </div>
        
        <form onSubmit={handleSave} className="p-8 space-y-8">
          {userRole === 'admin' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest">API Credentials</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">App Key</label>
                    <input 
                      type="password" 
                      value={settings.BKASH_APP_KEY}
                      onChange={(e) => setSettings({...settings, BKASH_APP_KEY: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">App Secret</label>
                    <input 
                      type="password" 
                      value={settings.BKASH_APP_SECRET}
                      onChange={(e) => setSettings({...settings, BKASH_APP_SECRET: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Username</label>
                    <input 
                      type="text" 
                      value={settings.BKASH_USERNAME}
                      onChange={(e) => setSettings({...settings, BKASH_USERNAME: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Password</label>
                    <input 
                      type="password" 
                      value={settings.BKASH_PASSWORD}
                      onChange={(e) => setSettings({...settings, BKASH_PASSWORD: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest">Environment Settings</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">bKash Base URL</label>
                    <input 
                      type="text" 
                      value={settings.BKASH_BASE_URL}
                      onChange={(e) => setSettings({...settings, BKASH_BASE_URL: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Application URL</label>
                    <input 
                      type="text" 
                      value={settings.APP_URL}
                      onChange={(e) => setSettings({...settings, APP_URL: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-zinc-800/30 p-6 rounded-2xl border border-zinc-800">
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <CreditCard className="text-bkash" size={18} />
                  Payment Gateway Selection
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setMerchantSettings({...merchantSettings, payment_mode: 'GLOBAL'})}
                    className={cn(
                      "p-6 rounded-2xl border text-left transition-all",
                      merchantSettings?.payment_mode === 'GLOBAL' 
                        ? "bg-bkash/10 border-bkash ring-1 ring-bkash" 
                        : "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold">Option 1: Global API</span>
                      {merchantSettings?.payment_mode === 'GLOBAL' && <CheckCircle2 className="text-bkash" size={20} />}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">Use the platform's shared bKash credentials. Ideal if you don't have your own bKash merchant API access yet.</p>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setMerchantSettings({...merchantSettings, payment_mode: 'OWN'})}
                    className={cn(
                      "p-6 rounded-2xl border text-left transition-all",
                      merchantSettings?.payment_mode === 'OWN' 
                        ? "bg-bkash/10 border-bkash ring-1 ring-bkash" 
                        : "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold">Option 2: Own Credentials</span>
                      {merchantSettings?.payment_mode === 'OWN' && <CheckCircle2 className="text-bkash" size={20} />}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">Use your own bKash App Key, Secret, and credentials. You keep full control over your bKash account.</p>
                  </button>
                </div>
              </div>

              {merchantSettings?.payment_mode === 'OWN' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Your App Key</label>
                      <input 
                        type="password" 
                        value={merchantSettings.bkash_app_key || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_app_key: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                        placeholder="Enter your bKash App Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Your App Secret</label>
                      <input 
                        type="password" 
                        value={merchantSettings.bkash_app_secret || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_app_secret: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                        placeholder="Enter your bKash App Secret"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Your bKash Username</label>
                      <input 
                        type="text" 
                        value={merchantSettings.bkash_username || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_username: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                        placeholder="01XXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Your bKash Password</label>
                      <input 
                        type="password" 
                        value={merchantSettings.bkash_password || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_password: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="bg-zinc-800/30 p-6 rounded-2xl border border-zinc-800">
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Key className="text-bkash" size={18} />
                  Your API Key
                </h4>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    readOnly
                    value={merchantSettings?.api_key || ""}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-zinc-400"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(merchantSettings?.api_key || "");
                      toast.success("API Key copied to clipboard");
                    }}
                    className="px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-3">Use this key to integrate bKash payments into your own website or application.</p>
              </div>
            </div>
          )}

          <div className="pt-8 border-t border-zinc-800 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-bkash hover:bg-bkash/90 disabled:bg-zinc-700 text-white font-bold px-10 py-4 rounded-2xl shadow-xl shadow-bkash/20 transition-all flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 backdrop-blur-sm shadow-sm dark:shadow-2xl">
          <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Palette className="text-bkash" size={20} />
            Theme Preferences
          </h4>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'system', label: 'System', icon: Monitor },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                  theme === t.id 
                    ? "bg-bkash/10 border-bkash text-bkash" 
                    : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                <t.icon size={24} />
                <span className="text-xs font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 backdrop-blur-sm shadow-sm dark:shadow-2xl">
          <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Image className="text-bkash" size={20} />
            Branding
          </h4>
          <div className="space-y-4">
            <label className="text-sm font-medium text-zinc-400">Site Logo</label>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                {settings.SITE_LOGO ? (
                  <img src={settings.SITE_LOGO} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <Image size={32} className="text-zinc-600" />
                )}
              </div>
              <div className="flex-1 space-y-3">
                <input 
                  type="file" 
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button 
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isUploadingLogo ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  Upload Logo
                </button>
                <p className="text-[10px] text-zinc-500 text-center">Recommended: PNG or SVG, max 2MB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Refunds = () => {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [searchTrxId, setSearchTrxId] = useState("");
  const [foundTx, setFoundTx] = useState<Transaction | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showConfirmRefund, setShowConfirmRefund] = useState(false);
  const isOnline = useOnlineStatus();
  
  const [searchParams] = useSearchParams();
  const queryTrxId = searchParams.get("trx_id");

  const [refundForm, setRefundForm] = useState({
    amount: "",
    reason: "Customer requested refund",
    sku: `REFUND-${new Date().toISOString().split('T')[0]}`
  });

  useEffect(() => {
    fetchRefunds();
    if (queryTrxId) {
      setSearchTrxId(queryTrxId);
      performSearch(queryTrxId);
    }
  }, [queryTrxId]);

  const fetchRefunds = async () => {
    try {
      const res = await fetch("/api/admin/refunds");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch refunds: ${res.status}`);
      }
      const data = await res.json();
      setRefunds(data);
    } catch (err: any) {
      console.error("Fetch Refunds Error:", err);
      toast.error(`Refunds Error: ${err.message}`);
    }
  };

  const performSearch = async (trxId: string) => {
    if (!trxId || trxId === "null") return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/transaction-search?trx_id=${trxId}`);
      const data = await res.json();
      setFoundTx(data);
      if (data) {
        setRefundForm(prev => ({ ...prev, amount: data.amount.toString() }));
        toast.success("Transaction found!");
      } else {
        toast.error(`Transaction with ID "${trxId}" not found.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error searching for transaction. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTrxId) return;
    performSearch(searchTrxId);
  };

  const handleRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundTx) return;
    setShowConfirmRefund(true);
  };

  const processRefund = async () => {
    if (!foundTx) return;
    setShowConfirmRefund(false);
    setIsProcessing(true);
    try {
      const payload = {
        paymentID: foundTx.payment_id,
        trxID: foundTx.trx_id,
        amount: refundForm.amount,
        sku: refundForm.sku,
        reason: refundForm.reason
      };

      if (!isOnline) {
        await queueAction({ type: 'refund', payload });
        toast.info("You are offline. Refund request queued for sync.");
        setFoundTx(null);
        setSearchTrxId("");
        return;
      }

      const res = await fetch("/api/bkash/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Refund processed successfully");
        fetchRefunds();
        setFoundTx(null);
        setSearchTrxId("");
      } else {
        toast.error(data.error || "Refund failed");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Process Refund & Search */}
        <div className="space-y-6">
          {/* Search Transaction Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 md:p-6 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Search size={20} className="text-bkash" />
              Search Transaction
            </h3>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="Enter Transaction ID (e.g. TST...)" 
                value={searchTrxId}
                onChange={(e) => setSearchTrxId(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50"
              />
              <button 
                type="submit" 
                disabled={isSearching}
                className="bg-bkash hover:bg-bkash/90 disabled:bg-zinc-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                Search
              </button>
            </form>

            {foundTx && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 p-5 bg-zinc-950/50 rounded-2xl border border-zinc-800 space-y-4">
                <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest">Transaction Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Transaction ID</p>
                    <p className="font-bold text-sm">{foundTx.trx_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Amount</p>
                    <p className="font-black text-bkash">{formatCurrency(foundTx.amount)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Customer</p>
                    <p className="text-sm">{foundTx.customer_msisdn || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Date</p>
                    <p className="text-xs text-zinc-400">{new Date(foundTx.created_at).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Payment Mode</p>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                      foundTx.payment_mode === 'OWN' ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {foundTx.payment_mode === 'OWN' ? "Merchant's Own API" : "Global API"}
                    </span>
                  </div>
                </div>
                {foundTx.payment_mode === 'GLOBAL' && (
                  <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-rose-200/80 leading-relaxed">
                      <strong>Refund Restricted:</strong> Super Admin cannot process refunds for transactions processed via Global API. These must be managed according to platform policy.
                    </p>
                  </div>
                )}
                {foundTx.payment_mode === 'OWN' && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-amber-200/80 leading-relaxed">
                      <strong>Refund Restricted:</strong> This transaction was processed using the merchant's own bKash credentials. Refunds must be handled directly through the merchant's bKash panel.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Process Refund Form Card */}
          <div className={cn(
            "bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 md:p-6 backdrop-blur-sm transition-opacity duration-300",
            !foundTx && "opacity-50 pointer-events-none"
          )}>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <RotateCcw size={20} className="text-rose-500" />
              Process Refund
            </h3>
            <form onSubmit={handleRefund} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase font-bold">Refund Amount <span className="text-rose-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase font-bold">SKU (Optional)</label>
                  <input 
                    type="text" 
                    value={refundForm.sku}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 uppercase font-bold">Reason (Optional)</label>
                <textarea 
                  rows={3}
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none"
                  placeholder="e.g. Customer requested refund"
                />
              </div>
              <button 
                type="submit" 
                disabled={isProcessing || !foundTx || foundTx.payment_mode === 'OWN' || foundTx.payment_mode === 'GLOBAL'}
                className="w-full bg-bkash hover:bg-bkash/90 disabled:bg-zinc-700 text-white font-black py-4 rounded-xl shadow-xl shadow-bkash/20 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : (foundTx?.payment_mode === 'OWN' || foundTx?.payment_mode === 'GLOBAL' ? "Refund Restricted" : "Initiate Refund Request")}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Recent Refunds Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <History size={20} className="text-bkash" />
              Recent Refund Requests
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-zinc-800/50 text-zinc-500 text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="py-4 px-4 font-black">Refund ID</th>
                  <th className="py-4 px-4 font-black">Amount</th>
                  <th className="py-4 px-4 font-black">Status</th>
                  <th className="py-4 px-4 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((ref) => (
                  <tr key={ref.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-sm">{ref.refund_id}</span>
                        <span className="text-zinc-500 text-[10px] font-mono">{ref.original_trx_id}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-black text-rose-500">{formatCurrency(ref.refund_amount)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter",
                        ref.status === 'COMPLETED' ? "bg-bkash/10 text-bkash" : 
                        ref.status === 'PENDING' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {ref.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button 
                        onClick={() => setSelectedRefund(ref)}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-lg transition-all"
                      >
                        <Info size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {refunds.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-zinc-600">
                        <RotateCcw size={40} className="opacity-20" />
                        <p className="text-sm font-medium">No refund requests found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmRefund && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setShowConfirmRefund(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping opacity-20" />
                  <AlertCircle size={40} className="text-rose-500 relative z-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">Confirm Refund</h3>
                  <p className="text-zinc-400 text-sm">
                    You are about to initiate a refund for this transaction. This action is irreversible.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950/50 rounded-2xl border border-zinc-800 p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Refund Amount</span>
                  <span className="text-xl font-black text-rose-500">{formatCurrency(parseFloat(refundForm.amount) || 0)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">TrxID</p>
                    <p className="text-xs font-mono text-white truncate">{foundTx?.trx_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">SKU</p>
                    <p className="text-xs text-white truncate">{refundForm.sku || 'N/A'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Reason</p>
                  <p className="text-xs text-zinc-300 italic">"{refundForm.reason || 'No reason provided'}"</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  disabled={isProcessing}
                  onClick={() => setShowConfirmRefund(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  disabled={isProcessing}
                  onClick={processRefund}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={20} /> : "Confirm Refund"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Refund Detail Modal */}
      <AnimatePresence>
        {selectedRefund && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRefund(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                <div>
                  <h3 className="font-black text-2xl tracking-tight">Refund Details</h3>
                  <p className="text-zinc-500 text-sm font-medium">Detailed audit information for this request</p>
                </div>
                <button onClick={() => setSelectedRefund(null)} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-400 hover:text-white transition-all"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Refund ID</p>
                      <p className="font-mono text-sm text-bkash font-bold">{selectedRefund.refund_id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Original TrxID</p>
                      <p className="font-mono text-sm">{selectedRefund.original_trx_id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Original Payment ID</p>
                      <p className="font-mono text-[10px] text-zinc-400 break-all">{selectedRefund.original_payment_id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Status</p>
                      <span className={cn(
                        "inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight",
                        selectedRefund.status === 'COMPLETED' ? "bg-bkash/10 text-bkash" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {selectedRefund.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Refund Amount</p>
                      <p className="text-2xl font-black text-rose-500">{formatCurrency(selectedRefund.refund_amount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Requested Amount</p>
                      <p className="text-sm font-bold text-zinc-300">{formatCurrency(selectedRefund.amount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">SKU / Reference</p>
                      <p className="text-sm font-medium">{selectedRefund.sku || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Initiated By</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-black">{selectedRefund.initiated_by?.[0]?.toUpperCase()}</div>
                        <p className="text-sm font-medium">{selectedRefund.initiated_by}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-zinc-950/50 rounded-2xl border border-zinc-800 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Reason for Refund</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{selectedRefund.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">IP Address</p>
                      <p className="text-xs font-mono text-zinc-400">{selectedRefund.ip_address || 'N/A'}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Created At</p>
                      <p className="text-xs text-zinc-400">{new Date(selectedRefund.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Raw API Response</p>
                  <pre className="bg-black p-5 rounded-2xl text-[10px] font-mono text-zinc-500 overflow-x-auto border border-zinc-800">
                    {JSON.stringify(JSON.parse(selectedRefund.response_data), null, 2)}
                  </pre>
                </div>
              </div>
              <div className="p-8 bg-zinc-950 border-t border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setSelectedRefund(null)}
                  className="px-10 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-black text-sm transition-all"
                >
                  Close Audit View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Layout ---

const Subscriptions = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const merchantId = localStorage.getItem("merchant_id");

  const fetchData = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/subscription-plans"),
        fetch(`/api/merchant/subscription?merchantId=${merchantId}`)
      ]);
      const [pData, sData] = await Promise.all([pRes.json(), sRes.json()]);
      setPlans(pData);
      setCurrentSub(sData);
    } catch (err) {
      toast.error("Failed to fetch subscription data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      const res = await fetch("/api/merchant/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, planId })
      });
      const data = await res.json();
      if (data.bkashURL) {
        toast.success("Redirecting to bKash for payment...");
        window.location.href = data.bkashURL;
      } else {
        toast.error(data.error || "Subscription failed");
      }
    } catch (err) {
      toast.error("Subscription failed");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {currentSub && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Check className="text-white" size={32} />
            </div>
            <div>
              <div className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-1">Active Subscription</div>
              <h3 className="text-2xl font-black">{currentSub.plan_name}</h3>
              <p className="text-zinc-500 text-sm">Valid until {new Date(currentSub.end_date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="bg-zinc-900/50 px-6 py-4 rounded-2xl border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Status</div>
            <div className="text-emerald-500 font-bold flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {currentSub.status}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan.id} className={cn(
            "bg-zinc-900 border rounded-3xl p-8 flex flex-col transition-all",
            currentSub?.plan_id === plan.id ? "border-bkash ring-4 ring-bkash/10" : "border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="mb-8">
              <h4 className="text-xl font-black mb-2">{plan.name}</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">{plan.description}</p>
            </div>
            <div className="mb-8">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black">৳{plan.price}</span>
                <span className="text-zinc-500 text-sm">/{plan.duration_days} days</span>
              </div>
            </div>
            <div className="space-y-4 mb-8 flex-1">
              {JSON.parse(plan.features || '[]').map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm text-zinc-400">
                  <div className="w-5 h-5 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                    <Check className="text-emerald-500" size={12} />
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button 
              onClick={() => handleSubscribe(plan.id)}
              disabled={currentSub?.plan_id === plan.id}
              className={cn(
                "w-full font-black py-4 rounded-2xl transition-all",
                currentSub?.plan_id === plan.id 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                  : "bg-bkash hover:bg-bkash/90 text-white shadow-xl shadow-bkash/20"
              )}
            >
              {currentSub?.plan_id === plan.id ? "Current Plan" : "Subscribe Now"}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const AdminPlans = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [merchantSubs, setMerchantSubs] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    price: '',
    duration_days: '30',
    features: ''
  });

  const fetchData = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/subscription-plans"),
        fetch("/api/admin/merchant-subscriptions")
      ]);
      const [pData, sData] = await Promise.all([pRes.json(), sRes.json()]);
      setPlans(pData);
      setMerchantSubs(sData);
    } catch (err) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPlan,
          price: parseFloat(newPlan.price),
          duration_days: parseInt(newPlan.duration_days),
          features: newPlan.features.split(',').map(f => f.trim())
        })
      });
      if (res.ok) {
        toast.success("Plan created");
        setShowAdd(false);
        setNewPlan({ name: '', description: '', price: '', duration_days: '30', features: '' });
        fetchData();
      }
    } catch (err) {
      toast.error("Failed to create plan");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black">Subscription Plans</h3>
        <button onClick={() => setShowAdd(true)} className="bg-bkash hover:bg-bkash/90 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-2 transition-all">
          <Plus size={20} /> Create Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan.id} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h4 className="text-xl font-black mb-2">{plan.name}</h4>
            <div className="text-2xl font-black text-bkash mb-4">৳{plan.price}</div>
            <p className="text-zinc-500 text-sm mb-6">{plan.description}</p>
            <div className="space-y-2">
              {JSON.parse(plan.features || '[]').map((f: string, i: number) => (
                <div key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                  <Check size={12} className="text-emerald-500" /> {f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-3xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-bkash-dark">
          <h3 className="font-bold text-lg">Merchant Subscriptions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bkash-dark/50 text-zinc-500 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6 font-semibold">Merchant</th>
                <th className="py-4 px-6 font-semibold">Plan</th>
                <th className="py-4 px-6 font-semibold">Status</th>
                <th className="py-4 px-6 font-semibold">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {merchantSubs.map(sub => (
                <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-4 px-6">
                    <div className="text-sm font-bold">{sub.merchant_name}</div>
                    <div className="text-[10px] text-zinc-500">{sub.merchant_email}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-xs font-bold">{sub.plan_name}</div>
                    <div className="text-[10px] text-zinc-500">৳{sub.price}</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                      sub.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-500/10 text-zinc-500"
                    )}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-xs text-zinc-400">
                    {new Date(sub.end_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {merchantSubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-500 text-sm">No active merchant subscriptions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-xl font-black mb-6">Create New Plan</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Plan Name</label>
                  <input type="text" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Description</label>
                  <textarea value={newPlan.description} onChange={e => setNewPlan({...newPlan, description: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash h-24" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Price (BDT)</label>
                    <input type="number" value={newPlan.price} onChange={e => setNewPlan({...newPlan, price: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Duration (Days)</label>
                    <input type="number" value={newPlan.duration_days} onChange={e => setNewPlan({...newPlan, duration_days: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Features (Comma separated)</label>
                  <input type="text" value={newPlan.features} onChange={e => setNewPlan({...newPlan, features: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash" placeholder="Feature 1, Feature 2..." required />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 bg-bkash hover:bg-bkash/90 text-white font-black py-3 rounded-xl shadow-xl shadow-bkash/20 transition-all">Create Plan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = async () => {
    try {
      const res = await fetch("/api/admin/withdrawals");
      const data = await res.json();
      setWithdrawals(data);
    } catch (err) {
      toast.error("Failed to fetch withdrawals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleStatus = async (id: string, status: string) => {
    const note = prompt("Admin Note (Optional):");
    try {
      const res = await fetch("/api/admin/withdrawals/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, admin_note: note })
      });
      if (res.ok) {
        toast.success(`Withdrawal ${status.toLowerCase()}`);
        fetchWithdrawals();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="bg-bkash-dark/50 border border-bkash-dark rounded-3xl overflow-hidden backdrop-blur-sm">
      <div className="p-6 border-b border-bkash-dark">
        <h3 className="font-bold text-lg">Withdrawal Requests</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-bkash-dark/50 text-zinc-500 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="py-4 px-6 font-semibold">Merchant</th>
              <th className="py-4 px-6 font-semibold">Account Info</th>
              <th className="py-4 px-6 font-semibold">Amount</th>
              <th className="py-4 px-6 font-semibold">Status</th>
              <th className="py-4 px-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {withdrawals.map(w => (
              <tr key={w.id} className="hover:bg-white/5 transition-colors">
                <td className="py-4 px-6">
                  <div className="text-sm font-bold">{w.merchant_name}</div>
                  <div className="text-[10px] text-zinc-500">{new Date(w.created_at).toLocaleString()}</div>
                </td>
                <td className="py-4 px-6">
                  <div className="text-xs font-bold">{w.provider} ({w.account_type})</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{w.account_number}</div>
                  {w.account_type === 'BANK' && (
                    <div className="text-[10px] text-zinc-400 mt-1">
                      <div>Name: {w.account_name}</div>
                      <div>Branch: {w.bank_branch}</div>
                      <div>Routing: {w.routing_number}</div>
                    </div>
                  )}
                </td>
                <td className="py-4 px-6 font-bold text-sm">৳{w.amount}</td>
                <td className="py-4 px-6">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                    w.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-500" :
                    w.status === 'PENDING' ? "bg-amber-500/10 text-amber-500" :
                    w.status === 'REJECTED' ? "bg-rose-500/10 text-rose-500" :
                    "bg-zinc-500/10 text-zinc-500"
                  )}>
                    {w.status}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  {w.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleStatus(w.id, 'COMPLETED')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all">Approve</button>
                      <button onClick={() => handleStatus(w.id, 'REJECTED')} className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PayoutAccounts = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAccount, setNewAccount] = useState({
    type: 'MFS',
    provider: 'bKash',
    account_number: '',
    account_name: '',
    bank_branch: '',
    routing_number: ''
  });
  const merchantId = localStorage.getItem("merchant_id");

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/merchant/payout-accounts?merchantId=${merchantId}`);
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      toast.error("Failed to fetch payout accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/merchant/payout-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newAccount, merchantId })
      });
      if (res.ok) {
        toast.success("Payout account added");
        setShowAdd(false);
        fetchAccounts();
      }
    } catch (err) {
      toast.error("Failed to add account");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`/api/merchant/payout-accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Account deleted");
        fetchAccounts();
      }
    } catch (err) {
      toast.error("Failed to delete account");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-lg">Payout Accounts</h4>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-bkash hover:bg-bkash/90 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
        >
          <Plus size={16} /> Add Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative group">
            <button 
              onClick={() => handleDelete(acc.id)}
              className="absolute top-4 right-4 text-zinc-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash size={16} />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-bkash/10 rounded-xl flex items-center justify-center">
                {acc.type === 'MFS' ? <Wallet className="text-bkash" size={24} /> : <Building2 className="text-bkash" size={24} />}
              </div>
              <div>
                <div className="font-bold text-sm">{acc.provider}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{acc.type} Account</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Number:</span>
                <span className="font-mono">{acc.account_number}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Name:</span>
                <span>{acc.account_name}</span>
              </div>
              {acc.bank_branch && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Branch:</span>
                  <span>{acc.bank_branch}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-xl font-black mb-6">Add Payout Account</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Type</label>
                    <select 
                      value={newAccount.type}
                      onChange={(e) => setNewAccount({...newAccount, type: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash"
                    >
                      <option value="MFS">MFS (Mobile)</option>
                      <option value="BANK">Bank Account</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Provider</label>
                    <input 
                      type="text" 
                      value={newAccount.provider}
                      onChange={(e) => setNewAccount({...newAccount, provider: e.target.value})}
                      placeholder="e.g. bKash, Dutch Bangla"
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Account Number</label>
                  <input 
                    type="text" 
                    value={newAccount.account_number}
                    onChange={(e) => setNewAccount({...newAccount, account_number: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Account Name</label>
                  <input 
                    type="text" 
                    value={newAccount.account_name}
                    onChange={(e) => setNewAccount({...newAccount, account_name: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash"
                    required
                  />
                </div>
                {newAccount.type === 'BANK' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Branch</label>
                      <input 
                        type="text" 
                        value={newAccount.bank_branch}
                        onChange={(e) => setNewAccount({...newAccount, bank_branch: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Routing No</label>
                      <input 
                        type="text" 
                        value={newAccount.routing_number}
                        onChange={(e) => setNewAccount({...newAccount, routing_number: e.target.value})}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 bg-bkash hover:bg-bkash/90 text-white font-black py-3 rounded-xl shadow-xl shadow-bkash/20 transition-all">Add Account</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [paymentMode, setPaymentMode] = useState("GLOBAL");
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const merchantId = localStorage.getItem("merchant_id");

  const fetchData = async () => {
    try {
      const [wRes, aRes, mRes] = await Promise.all([
        fetch(`/api/merchant/withdrawals?merchantId=${merchantId}`),
        fetch(`/api/merchant/payout-accounts?merchantId=${merchantId}`),
        fetch(`/api/merchant/settings?merchantId=${merchantId}`)
      ]);
      const [wData, aData, mData] = await Promise.all([wRes.json(), aRes.json(), mRes.json()]);
      setWithdrawals(wData);
      setAccounts(aData);
      setBalance(mData.balance || 0);
      setPaymentMode(mData.payment_mode || "GLOBAL");
      if (aData.length > 0) setSelectedAccount(aData[0].id);
    } catch (err) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCcw className="animate-spin text-bkash" /></div>;

  if (paymentMode === 'OWN') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8">
        <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center">
          <ShieldAlert className="text-amber-500" size={48} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black tracking-tight">Withdrawals Unavailable</h3>
          <p className="text-zinc-500 max-w-md mx-auto font-medium">
            You are currently using your own bKash API credentials. Payments are settled directly to your merchant account by bKash. Withdrawals are only required when using our Global API mode.
          </p>
        </div>
        <button 
          onClick={() => window.location.href = '/admin/settings'}
          className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-8 py-3 rounded-2xl transition-all"
        >
          Check Settings
        </button>
      </motion.div>
    );
  }

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseFloat(amount) > balance) return toast.error("Insufficient balance");
    if (!selectedAccount) return toast.error("Please select a payout account");

    try {
      const res = await fetch("/api/merchant/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, payout_account_id: selectedAccount, amount: parseFloat(amount) })
      });
      if (res.ok) {
        toast.success("Withdrawal request submitted");
        setShowRequest(false);
        fetchData();
      }
    } catch (err) {
      toast.error("Failed to submit request");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-bkash p-8 rounded-3xl text-white shadow-2xl shadow-bkash/30 relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Available Balance</div>
              <div className="text-4xl font-black mb-6">৳{balance.toLocaleString()}</div>
              <button 
                onClick={() => setShowRequest(true)}
                className="w-full bg-white text-bkash font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <ArrowUpRight size={20} /> Request Withdrawal
              </button>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </div>
          
          <PayoutAccounts />
        </div>

        <div className="lg:col-span-2 bg-bkash-dark/50 border border-bkash-dark rounded-3xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-bkash-dark flex justify-between items-center">
            <h3 className="font-bold text-lg">Withdrawal History</h3>
            <RefreshCcw size={18} className="text-zinc-500 cursor-pointer hover:text-bkash transition-colors" onClick={fetchData} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bkash-dark/50 text-zinc-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6 font-semibold">Date</th>
                  <th className="py-4 px-6 font-semibold">Account</th>
                  <th className="py-4 px-6 font-semibold">Amount</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {withdrawals.map(w => (
                  <tr key={w.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6 text-xs text-zinc-400">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-bold">{w.provider}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{w.account_number}</div>
                    </td>
                    <td className="py-4 px-6 font-bold text-sm">৳{w.amount}</td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                        w.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-500" :
                        w.status === 'PENDING' ? "bg-amber-500/10 text-amber-500" :
                        w.status === 'REJECTED' ? "bg-rose-500/10 text-rose-500" :
                        "bg-zinc-500/10 text-zinc-500"
                      )}>
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-xl font-black mb-6">Request Withdrawal</h3>
              <form onSubmit={handleRequest} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Amount to Withdraw</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-zinc-500">৳</span>
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-10 pr-4 text-2xl font-bold focus:outline-none focus:border-bkash"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500 text-right">Max: ৳{balance.toLocaleString()}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Select Payout Account</label>
                  <div className="space-y-2">
                    {accounts.map(acc => (
                      <label key={acc.id} className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                        selectedAccount === acc.id ? "bg-bkash/10 border-bkash" : "bg-black border-zinc-800 hover:border-zinc-700"
                      )}>
                        <input 
                          type="radio" 
                          name="account" 
                          checked={selectedAccount === acc.id}
                          onChange={() => setSelectedAccount(acc.id)}
                          className="hidden"
                        />
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          selectedAccount === acc.id ? "border-bkash" : "border-zinc-700"
                        )}>
                          {selectedAccount === acc.id && <div className="w-2 h-2 bg-bkash rounded-full" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{acc.provider} ({acc.account_number})</div>
                          <div className="text-[10px] text-zinc-500">{acc.account_name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowRequest(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 bg-bkash hover:bg-bkash/90 text-white font-black py-3 rounded-xl shadow-xl shadow-bkash/20 transition-all">Submit Request</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ApiDocs = () => {
  const merchantId = localStorage.getItem("merchant_id");
  const apiKey = "bk_live_xxxxxxxxxxxxxxxxxxxxxxxx"; // Mock for docs
  const appUrl = window.location.origin;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-3xl p-8 backdrop-blur-sm">
        <h3 className="text-2xl font-black mb-4 flex items-center gap-3">
          <BookOpen className="text-bkash" size={28} />
          Merchant API Documentation
        </h3>
        <p className="text-zinc-400 leading-relaxed max-w-3xl">
          Integrate bKash payments into your website or application using our simple REST API. 
          Whether you use our Global API or your own credentials, the integration process remains the same.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-bold text-lg mb-4">1. Authentication</h4>
            <p className="text-sm text-zinc-500 mb-4">All API requests must include your API Key in the headers.</p>
            <div className="bg-black rounded-xl p-4 font-mono text-xs text-emerald-500 overflow-x-auto">
              Authorization: Bearer {apiKey}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h4 className="font-bold text-lg mb-4">2. Create Payment</h4>
            <p className="text-sm text-zinc-500 mb-4">Endpoint to initiate a bKash payment session.</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Post</span>
                <span className="text-xs font-mono text-zinc-400">{appUrl}/api/bkash/create-payment</span>
              </div>
              <div className="bg-black rounded-xl p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
                {`{
  "amount": "100.00",
  "invoice": "INV-123456",
  "merchantId": "${merchantId || 'YOUR_MERCHANT_ID'}"
}`}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h4 className="font-bold text-lg mb-4 flex items-center justify-between">
            Try It Now
            <span className="text-[10px] bg-bkash/10 text-bkash px-2 py-1 rounded-full uppercase tracking-widest">Sandbox</span>
          </h4>
          <p className="text-sm text-zinc-500 mb-6">Test the payment flow directly from this documentation.</p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Test Amount</label>
              <input type="number" defaultValue="10" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-bkash transition-all" />
            </div>
            <button 
              onClick={async () => {
                const amount = (document.querySelector('input[type="number"]') as HTMLInputElement).value;
                toast.loading("Initiating test payment...");
                try {
                  const res = await fetch("/api/bkash/create-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount, invoice: `TEST-${Date.now()}`, merchantId }),
                  });
                  const data = await res.json();
                  if (data.bkashURL) {
                    window.open(data.bkashURL, '_blank');
                    toast.dismiss();
                    toast.success("Test payment initiated in new tab!");
                  } else {
                    toast.error(data.error || "Failed to initiate");
                  }
                } catch (err) {
                  toast.error("Something went wrong");
                }
              }}
              className="w-full bg-bkash hover:bg-bkash/90 text-white font-bold py-4 rounded-xl shadow-xl shadow-bkash/20 transition-all flex items-center justify-center gap-2"
            >
              <Zap size={18} /> Initiate Test Payment
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-zinc-800">
            <h5 className="font-bold text-sm mb-4">Integration Modes</h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <div className="text-bkash font-bold text-xs mb-1">Global Mode</div>
                <p className="text-[10px] text-zinc-500">No bKash merchant account needed. Withdraw balance to your MFS/Bank.</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                <div className="text-blue-500 font-bold text-xs mb-1">Own Mode</div>
                <p className="text-[10px] text-zinc-500">Use your own bKash credentials. Money goes directly to your account.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AdminLogin = () => {
  const [username, setUsername] = useState(localStorage.getItem("rememberedUsername") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("rememberedUsername"));
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        localStorage.setItem("isAdmin", "true");
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("userName", data.user.username);
        localStorage.setItem("userEmail", data.user.email);
        localStorage.setItem("userRole", data.user.role);
        localStorage.setItem("merchant_id", data.user.merchant_id || "");
        localStorage.setItem("userAvatar", data.user.avatar || "");
        localStorage.setItem("userPermissions", data.user.permissions.join(","));
        
        if (rememberMe) {
          localStorage.setItem("rememberedUsername", username);
        } else {
          localStorage.removeItem("rememberedUsername");
        }
        window.dispatchEvent(new Event("storage"));
        toast.success("Login successful! Welcome back.");
        navigate("/admin");
      } else {
        toast.error(data.error || "Invalid credentials");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsForgotLoading(true);
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowForgotModal(false);
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-bkash/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-bkash/5 rounded-full -ml-16 -mb-16 blur-3xl" />

        <div className="text-center mb-10 relative">
          <div className="w-20 h-20 bg-bkash rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-bkash/20 rotate-3">
            <CreditCard className="text-white" size={40} />
          </div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Admin Portal</h2>
          <p className="text-zinc-500 mt-2 font-medium">Secure access to bKash Enterprise Gateway</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 relative">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Username or Email</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-white focus:border-bkash focus:outline-none transition-all" 
                placeholder="admin@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Password</label>
              <button 
                type="button" 
                onClick={() => setShowForgotModal(true)}
                className="text-[10px] font-bold text-bkash hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-white focus:border-bkash focus:outline-none transition-all" 
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-1">
            <input 
              type="checkbox" 
              id="remember" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-bkash focus:ring-bkash/50"
            />
            <label htmlFor="remember" className="text-xs text-zinc-500 cursor-pointer">Remember me</label>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-bkash hover:bg-bkash/90 text-white font-black py-4 rounded-xl shadow-xl shadow-bkash/20 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-500">
            Don't have a merchant account?{" "}
            <Link to="/merchant/register" className="text-bkash font-bold hover:underline">
              Register Now
            </Link>
          </p>
        </div>

        <AnimatePresence>
          {showForgotModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl"
              >
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Reset Password</h3>
                <p className="text-zinc-500 text-sm mb-6">Enter your email address and we'll send you a link to reset your password.</p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
                    <input 
                      type="email" 
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-zinc-900 dark:text-white focus:border-bkash focus:outline-none transition-all" 
                      placeholder="admin@example.com"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold py-3 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isForgotLoading}
                      className="flex-1 bg-bkash hover:bg-bkash/90 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {isForgotLoading ? <Loader2 className="animate-spin" size={18} /> : "Send Link"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <Link to="/" className="text-zinc-500 hover:text-bkash text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Back to Checkout
          </Link>
        </div>
      </motion.div>
      <p className="text-center text-zinc-600 text-[10px] mt-8 uppercase tracking-widest absolute bottom-8 w-full">
        &copy; {new Date().getFullYear()} bKash Enterprise Gateway • Secure Environment
      </p>
    </div>
  );
};

const MerchantRegister = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/merchant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Registration successful! Please login.");
        navigate("/admin/login");
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-bkash" />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-bkash rounded-3xl flex items-center justify-center shadow-2xl shadow-bkash/30 mb-6 rotate-3">
            <UserPlus className="text-white" size={40} />
          </div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Merchant Sign Up</h2>
          <p className="text-zinc-500 font-medium mt-2 text-center">Start accepting bKash payments today.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Business Name</label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-bkash transition-colors" size={18} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-white focus:border-bkash focus:outline-none transition-all" 
                  placeholder="Acme Corp"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-bkash transition-colors" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-white focus:border-bkash focus:outline-none transition-all" 
                  placeholder="merchant@example.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-bkash transition-colors" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-white focus:border-bkash focus:outline-none transition-all" 
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-bkash hover:bg-bkash/90 text-white font-black py-4 rounded-xl shadow-xl shadow-bkash/20 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Create Merchant Account"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500">
            Already have an account?{" "}
            <Link to="/admin/login" className="text-bkash font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const UserProfile = () => {
  const [user, setUser] = useState({
    name: localStorage.getItem("userName") || "Administrator",
    email: localStorage.getItem("userEmail") || "admin@bkash-pay.com",
    phone: localStorage.getItem("userPhone") || "+880 1997-473177",
    avatar: localStorage.getItem("userAvatar") || "https://picsum.photos/seed/admin/200/200"
  });
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);
    const userId = localStorage.getItem("userId");
    if (userId) formData.append("userId", userId);

    setIsUploadingAvatar(true);
    try {
      const res = await fetch("/api/admin/profile/upload-avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUser({ ...user, avatar: data.url });
        localStorage.setItem("userAvatar", data.url);
        toast.success("Avatar updated successfully");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("userName", user.name);
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userPhone", user.phone);
    localStorage.setItem("userAvatar", user.avatar);
    setIsEditing(false);
    toast.success("Profile updated successfully!");
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      toast.error("Username and password are required");
      return;
    }
    
    setIsUpdatingCreds(true);
    try {
      const res = await fetch("/api/admin/update-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Credentials updated successfully!");
        setCredentials({ username: "", password: "" });
      } else {
        toast.error(data.error || "Failed to update credentials");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setIsUpdatingCreds(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="h-32 bg-gradient-to-r from-bkash to-rose-400" />
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6 flex justify-between items-end">
            <div className="relative group">
              <div className="h-32 w-32 rounded-3xl bg-zinc-800 border-4 border-zinc-900 overflow-hidden shadow-xl">
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <button 
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -bottom-2 -right-2 p-2.5 bg-bkash text-white rounded-xl shadow-lg hover:scale-110 transition-transform active:scale-95 z-10"
              >
                {isUploadingAvatar ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
              </button>
              <input 
                type="file" 
                ref={avatarInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2"
              >
                <Settings size={18} /> Edit Profile
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Full Name</label>
                <input 
                  type="text" 
                  disabled={!isEditing}
                  value={user.name}
                  onChange={(e) => setUser({...user, name: e.target.value})}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Email Address</label>
                <input 
                  type="email" 
                  disabled={!isEditing}
                  value={user.email}
                  onChange={(e) => setUser({...user, email: e.target.value})}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Phone Number</label>
                <input 
                  type="tel" 
                  disabled={!isEditing}
                  value={user.phone}
                  onChange={(e) => setUser({...user, phone: e.target.value})}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Avatar URL</label>
                <input 
                  type="url" 
                  disabled={!isEditing}
                  value={user.avatar}
                  onChange={(e) => setUser({...user, avatar: e.target.value})}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all disabled:opacity-50"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-4 pt-4">
                <button 
                  type="submit"
                  className="bg-bkash hover:bg-bkash/90 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-bkash/20 transition-all"
                >
                  Save Changes
                </button>
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <ShieldCheck className="text-bkash" />
          Login Credentials
        </h3>
        <form onSubmit={handleUpdateCredentials} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">New Username</label>
              <input 
                type="text" 
                value={credentials.username}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                placeholder="Enter new username"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">New Password</label>
              <input 
                type="password" 
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                placeholder="Enter new password"
                required
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isUpdatingCreds}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isUpdatingCreds ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            Update Credentials
          </button>
        </form>
      </div>
    </motion.div>
  );
};

const Analytics = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-bkash" size={48} /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Volume" value={formatCurrency(data?.last7Days?.reduce((acc: any, curr: any) => acc + curr.total, 0) || 0)} icon={TrendingUp} trend={5.2} color="bg-bkash" />
        <StatCard title="Success Rate" value="98.5%" icon={CheckCircle2} trend={0.5} color="bg-emerald-600" />
        <StatCard title="Total Customers" value="1,284" icon={Users} trend={12.4} color="bg-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm">
          <h3 className="font-bold text-xl mb-8 flex items-center gap-2">
            <TrendingUp className="text-bkash" size={20} />
            Revenue Trends (Last 7 Days)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.last7Days}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E2136E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#E2136E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="total" stroke="#E2136E" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm">
          <h3 className="font-bold text-xl mb-8 flex items-center gap-2">
            <Activity className="text-blue-500" size={20} />
            Transaction Status Distribution
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {data?.statusDistribution?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#E2136E', '#10b981', '#f59e0b', '#3b82f6'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm">
        <h3 className="font-bold text-xl mb-8 flex items-center gap-2">
          <Zap className="text-amber-500" size={20} />
          Hourly Transaction Volume
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.hourlyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="hour" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
              <Bar dataKey="total" fill="#E2136E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};

const Customers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/customers")
      .then(res => res.json())
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-bkash" size={48} /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-3xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-bkash-dark flex justify-between items-center bg-zinc-950/50">
          <h3 className="font-bold text-lg">Customer Directory</h3>
          <div className="flex gap-2">
            <button className="bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-colors">Export CSV</button>
            <button className="bg-bkash text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-bkash/90 transition-colors shadow-lg shadow-bkash/20">Add Customer</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bkash-dark/50 text-zinc-500 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="py-4 px-6 font-bold">Customer MSISDN</th>
                <th className="py-4 px-6 font-bold">Total Transactions</th>
                <th className="py-4 px-6 font-bold">Total Spent</th>
                <th className="py-4 px-6 font-bold">Last Activity</th>
                <th className="py-4 px-6 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={i} className="border-b border-bkash-dark/50 hover:bg-bkash-dark/30 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-bkash/10 flex items-center justify-center text-bkash font-bold text-xs">
                        {c.msisdn.slice(-2)}
                      </div>
                      <span className="font-bold text-sm text-zinc-200">{c.msisdn}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-zinc-400 text-sm">{c.total_transactions} orders</td>
                  <td className="py-4 px-6 font-black text-white">{formatCurrency(c.total_spent)}</td>
                  <td className="py-4 px-6 text-zinc-500 text-xs">{new Date(c.last_transaction).toLocaleString()}</td>
                  <td className="py-4 px-6 text-right">
                    <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

const Statements = () => {
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  const fetchStatement = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/statement?from=${from}&to=${to}`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      toast.error("Failed to fetch statement data");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (transactions.length === 0) {
      toast.error("No transactions found for the selected period");
      return;
    }
    generateStatementPDF(transactions, from, to);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm">
        <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
          <Download className="text-bkash" />
          Generate Account Statement
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">From Date</label>
            <input 
              type="date" 
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-bkash focus:outline-none transition-all" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">To Date</label>
            <input 
              type="date" 
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-bkash focus:outline-none transition-all" 
            />
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchStatement}
              disabled={loading}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Fetch Data"}
            </button>
            <button 
              onClick={handleDownload}
              disabled={transactions.length === 0}
              className="flex-1 bg-bkash hover:bg-bkash/90 disabled:bg-zinc-800 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-bkash/20"
            >
              <Download size={18} /> Download PDF
            </button>
          </div>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="bg-bkash-dark/50 border border-bkash-dark rounded-3xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-bkash-dark bg-zinc-950/50">
            <h4 className="font-bold">Preview ({transactions.length} Transactions)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bkash-dark/50 text-zinc-500 text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Trx ID</th>
                  <th className="py-4 px-6">Customer</th>
                  <th className="py-4 px-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i} className="border-b border-bkash-dark/50">
                    <td className="py-4 px-6 text-sm text-zinc-400">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6 font-mono text-sm">{t.trx_id}</td>
                    <td className="py-4 px-6 text-sm">{t.customer_msisdn}</td>
                    <td className="py-4 px-6 text-right font-bold text-bkash">{formatCurrency(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const Security = () => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <ShieldCheck className="text-bkash" />
          Security Overview
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-bkash-dark/50 rounded-xl">
            <div>
              <p className="font-bold">Two-Factor Authentication</p>
              <p className="text-xs text-zinc-500">Add an extra layer of security</p>
            </div>
            <div className="w-12 h-6 bg-bkash rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
          <div className="flex justify-between items-center p-4 bg-bkash-dark/50 rounded-xl">
            <div>
              <p className="font-bold">IP Whitelisting</p>
              <p className="text-xs text-zinc-500">Restrict access to specific IPs</p>
            </div>
            <div className="w-12 h-6 bg-zinc-700 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Activity className="text-bkash" />
          Recent Logins
        </h3>
        <div className="space-y-4">
          {[
            { device: "Chrome / Windows", ip: "103.120.2.45", time: "Just now" },
            { device: "Safari / iPhone", ip: "192.168.1.1", time: "2 hours ago" },
          ].map((l, i) => (
            <div key={i} className="flex justify-between items-center p-3 border-b border-zinc-800 last:border-0">
              <div>
                <p className="text-sm font-bold">{l.device}</p>
                <p className="text-[10px] text-zinc-500">{l.ip}</p>
              </div>
              <p className="text-[10px] text-zinc-500">{l.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

const NotificationBar = () => {
  const [notifications, setNotifications] = useState([
    { id: 1, title: "New Payment Received", message: "Invoice #INV-1234 has been paid.", time: "2m ago", type: "success" },
    { id: 2, title: "Refund Requested", message: "Customer Sumi Akter requested a refund.", time: "15m ago", type: "warning" },
    { id: 3, title: "System Update", message: "Security patches applied successfully.", time: "1h ago", type: "info" },
  ]);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors relative"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-bkash rounded-full border-2 border-zinc-900" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[70]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-bkash-dark border border-bkash-dark rounded-2xl shadow-2xl z-[80] overflow-hidden"
            >
              <div className="p-4 border-b border-bkash-dark flex justify-between items-center bg-zinc-950/50">
                <h4 className="font-bold text-sm">Notifications</h4>
                <button onClick={() => setNotifications([])} className="text-[10px] text-zinc-500 hover:text-bkash">Clear all</button>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-600">
                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs">No new notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-4 border-b border-bkash-dark/50 hover:bg-bkash-dark/30 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <h5 className="font-bold text-xs text-white">{n.title}</h5>
                        <span className="text-[9px] text-zinc-500">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 bg-zinc-950/50 border-t border-bkash-dark text-center">
                <button className="text-[10px] font-bold text-bkash hover:underline">View all activity</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const SearchTransaction = () => {
  const [trxID, setTrxID] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isOnline = useOnlineStatus();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxID) return;
    if (!isOnline) {
      toast.error("You are offline. Search requires an active internet connection.");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/bkash/search-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trxID }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        if (data.statusCode === "0000") {
          toast.success("Transaction found!");
        } else {
          toast.error(data.statusMessage || "Search failed");
        }
      } else {
        toast.error(data.error || "Search failed");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!result) return;
    generateReceipt({
      trxID: result.trxID,
      amount: result.amount,
      customer: result.customerMsisdn,
      invoice: result.transactionReference,
      time: result.completedTime
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-3xl p-5 md:p-8 backdrop-blur-sm shadow-2xl">
        <h3 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-3">
          <Search className="text-bkash" />
          Search Transaction Details
        </h3>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <input 
            type="text" 
            placeholder="Enter Transaction ID (e.g. TST...)" 
            value={trxID}
            onChange={(e) => setTrxID(e.target.value)}
            className="flex-1 bg-bkash-dark/50 border border-bkash-dark rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
          />
          <button 
            type="submit" 
            disabled={loading || !isOnline}
            className="bg-bkash hover:bg-bkash/90 disabled:bg-zinc-700 text-white font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            Search
          </button>
        </form>

        {result && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-10 space-y-8">
            <div className="flex justify-between items-center border-b border-bkash-dark pb-4">
              <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest">Search Result</h4>
              {result.statusCode === "0000" && (
                <button 
                  onClick={handleDownloadReceipt}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                >
                  <Download size={14} /> Download Receipt
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest border-b border-bkash-dark pb-2">Transaction Information</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Transaction ID</span>
                    <span className="font-bold text-bkash">{result.trxID || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Amount</span>
                    <span className="font-black text-xl">{result.amount} {result.currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Status</span>
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight",
                      result.transactionStatus === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {result.transactionStatus || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Transaction Type</span>
                    <span className="text-sm font-medium">{result.transactionType || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest border-b border-bkash-dark pb-2">Customer & Time</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Customer MSISDN</span>
                    <span className="text-sm font-bold">{result.customerMsisdn || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Initiation Time</span>
                    <span className="text-sm text-zinc-300">{result.initiationTime || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Completed Time</span>
                    <span className="text-sm text-zinc-300">{result.completedTime || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-500">Organization Code</span>
                    <span className="text-sm text-zinc-400">{result.organizationShortCode || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-950/50 rounded-2xl border border-bkash-dark space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 uppercase font-black tracking-widest">Transaction Reference</span>
                <span className="text-sm font-medium italic">"{result.transactionReference || 'No reference'}"</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-bkash-dark">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Status Code</p>
                  <p className="text-xs font-mono text-white">{result.statusCode}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Status Message</p>
                  <p className="text-xs text-zinc-400">{result.statusMessage}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    permissions: [] as string[]
  });

  const allPermissions = [
    { id: "dashboard", label: "Dashboard" },
    { id: "transactions", label: "Payments" },
    { id: "search", label: "Search Details" },
    { id: "refunds", label: "Refunds" },
    { id: "logs", label: "System Logs" },
    { id: "audit-logs", label: "Audit Trail" },
    { id: "settings", label: "Settings" },
    { id: "profile", label: "Profile" },
    { id: "analytics", label: "Analytics" },
    { id: "customers", label: "Customers" },
    { id: "statements", label: "Statements" },
    { id: "security", label: "Security" },
    { id: "user-management", label: "User Management" }
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
    const method = editingUser ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success(editingUser ? "User updated" : "User created");
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Operation failed");
      }
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("User deleted");
        fetchUsers();
      }
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl md:text-2xl font-bold">User Management</h3>
        <button 
          onClick={() => {
            setEditingUser(null);
            setFormData({ username: "", password: "", role: "user", permissions: [] });
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto bg-bkash text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <UserPlus size={20} /> Add User
        </button>
      </div>

      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-bkash-dark/50 text-zinc-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">User</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Permissions</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center"><Loader2 className="animate-spin inline-block" /></td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="border-b border-bkash-dark/50 hover:bg-bkash-dark/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-bkash/10 flex items-center justify-center text-bkash font-bold text-sm overflow-hidden">
                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{user.username}</p>
                        <p className="text-[10px] text-zinc-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      user.role === 'admin' ? "bg-bkash/10 text-bkash" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.split(",").map((p: string) => (
                        <span key={p} className="bg-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded uppercase">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    <button 
                      onClick={() => {
                        setEditingUser(user);
                        setFormData({
                          username: user.username,
                          email: user.email || "",
                          password: "",
                          role: user.role,
                          permissions: user.permissions.split(",")
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-5 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <h4 className="text-xl font-bold mb-6">{editingUser ? "Edit User" : "Add New User"}</h4>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Username</label>
                    <input 
                      type="text" required
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Email Address</label>
                    <input 
                      type="email" required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Password {editingUser && "(Leave blank to keep current)"}</label>
                    <input 
                      type="password" required={!editingUser}
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Role</label>
                    <select 
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">Permissions</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
                    {allPermissions.map(perm => (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.id)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all border",
                          formData.permissions.includes(perm.id)
                            ? "bg-bkash/10 border-bkash text-bkash"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500"
                        )}
                      >
                        {perm.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button 
                    type="button" onClick={() => setIsModalOpen(false)}
                    className="order-2 sm:order-1 flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="order-1 sm:order-2 flex-1 bg-bkash hover:bg-bkash/90 py-3 rounded-xl font-bold transition-all text-white"
                  >
                    {editingUser ? "Update User" : "Create User"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem("isAdmin") === "true");
  const isOnline = useOnlineStatus();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [permissions, setPermissions] = useState<string[]>(user.permissions || []);
  const userRole = localStorage.getItem("userRole");
  const hasPermission = (perm: string) => userRole === 'admin' || permissions.includes(perm);

  useEffect(() => {
    const syncProfile = async () => {
      if (localStorage.getItem("isAdmin") === "true") {
        try {
          const res = await fetch("/api/user/profile");
          const data = await res.json();
          if (res.ok) {
            localStorage.setItem("user", JSON.stringify(data));
            setPermissions(data.permissions || []);
            window.dispatchEvent(new Event("storage"));
          }
        } catch (err) {
          console.error("Profile sync failed:", err);
        }
      }
    };
    syncProfile();
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const isAdmin = localStorage.getItem("isAdmin") === "true";
      setIsAdmin(isAdmin);
      
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setPermissions(user.permissions || []);
      const permissions = user.permissions || [];
      
      if (isAdmin && pathname.startsWith("/admin")) {
        const currentRoute = pathname.split("/").pop() || "admin";
        
        const routeToPerm: Record<string, string> = {
          "admin": "dashboard",
          "transactions": "transactions",
          "search": "search",
          "refunds": "refunds",
          "logs": "logs",
          "audit-logs": "audit-logs",
          "analytics": "analytics",
          "customers": "customers",
          "security": "security",
          "users": "user-management",
          "settings": "settings",
          "profile": "profile",
          "api-docs": "api-docs",
          "withdrawals": "withdrawals",
          "subscriptions": "subscriptions"
        };
        
        const requiredPerm = routeToPerm[currentRoute];
        if (requiredPerm && !permissions.includes(requiredPerm)) {
          toast.error("You don't have permission to access this page");
          navigate("/admin");
        }
      }
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, [pathname]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleNavClick = (path: string) => {
    navigate(path);
    closeMobileMenu();
  };

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("user");
    setIsAdmin(false);
    toast.info("Logged out successfully");
    navigate("/");
  };

  const isCheckoutOnly = pathname === "/" || pathname === "/payment-success" || pathname === "/payment-failed";
  const isAdminLogin = pathname === "/admin/login";

  if (isCheckoutOnly || isAdminLogin) {
    return <div className="min-h-screen bg-black text-white font-sans selection:bg-bkash/30">{children}</div>;
  }

  if (pathname.startsWith("/admin") && !isAdmin) {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans selection:bg-bkash/30">
      <SyncManager />
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-bkash-dark flex items-center justify-between px-4 z-[60]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-bkash rounded-lg flex items-center justify-center">
            <CreditCard className="text-white" size={18} />
          </div>
          <h1 className="font-bold text-base">bKash Pay</h1>
        </div>
        <button 
          onClick={toggleMobileMenu}
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-bkash-dark p-6 flex flex-col gap-8 z-50 transition-transform duration-300 lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden lg:flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-bkash rounded-xl flex items-center justify-center shadow-lg shadow-bkash/20">
            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s" alt="bKash" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">bKash Pay</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Enterprise</p>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )} />
            </div>
          </div>
        </div>

        <div className="lg:hidden h-10" />

        <nav className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {hasPermission('dashboard') && <SidebarItem icon={LayoutDashboard} label="Dashboard" active={pathname === '/admin'} onClick={() => handleNavClick('/admin')} />}
          {hasPermission('transactions') && <SidebarItem icon={History} label="Payments" active={pathname === '/admin/transactions'} onClick={() => handleNavClick('/admin/transactions')} />}
          {hasPermission('search') && <SidebarItem icon={Search} label="Search Details" active={pathname === '/admin/search'} onClick={() => handleNavClick('/admin/search')} />}
          {hasPermission('refunds') && <SidebarItem icon={RotateCcw} label="Refunds" active={pathname === '/admin/refunds'} onClick={() => handleNavClick('/admin/refunds')} />}
          {hasPermission('logs') && <SidebarItem icon={Terminal} label="System Logs" active={pathname === '/admin/logs'} onClick={() => handleNavClick('/admin/logs')} />}
          {hasPermission('audit-logs') && <SidebarItem icon={Activity} label="Audit Trail" active={pathname === '/admin/audit-logs'} onClick={() => handleNavClick('/admin/audit-logs')} />}
          {hasPermission('profile') && <SidebarItem icon={User} label="My Profile" active={pathname === '/admin/profile'} onClick={() => handleNavClick('/admin/profile')} />}
          {hasPermission('analytics') && <SidebarItem icon={TrendingUp} label="Analytics" active={pathname === '/admin/analytics'} onClick={() => handleNavClick('/admin/analytics')} />}
          {hasPermission('customers') && <SidebarItem icon={Users} label="Customers" active={pathname === '/admin/customers'} onClick={() => handleNavClick('/admin/customers')} />}
          {hasPermission('statements') && <SidebarItem icon={Download} label="Statements" active={pathname === '/admin/statements'} onClick={() => handleNavClick('/admin/statements')} />}
          {hasPermission('security') && <SidebarItem icon={ShieldCheck} label="Security" active={pathname === '/admin/security'} onClick={() => handleNavClick('/admin/security')} />}
          {hasPermission('user-management') && <SidebarItem icon={UserPlus} label="Users" active={pathname === '/admin/users'} onClick={() => handleNavClick('/admin/users')} />}
          {hasPermission('api-docs') && <SidebarItem icon={BookOpen} label="API Documentation" active={pathname === '/admin/api-docs'} onClick={() => handleNavClick('/admin/api-docs')} />}
          {hasPermission('withdrawals') && <SidebarItem icon={Wallet} label="Withdrawals" active={pathname === '/admin/withdrawals'} onClick={() => handleNavClick('/admin/withdrawals')} />}
          {hasPermission('subscriptions') && <SidebarItem icon={Zap} label="Subscriptions" active={pathname === '/admin/subscriptions'} onClick={() => handleNavClick('/admin/subscriptions')} />}
          <SidebarItem icon={Share2} label="Payment Links" active={pathname === '/generate'} onClick={() => handleNavClick('/generate')} />
        </nav>
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
          <SidebarItem icon={Settings} label="Settings" active={pathname === '/admin/settings'} onClick={() => handleNavClick('/admin/settings')} />
          <SidebarItem icon={LogOut} label="Logout" onClick={handleLogout} />
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      <main className="lg:ml-64 p-3 md:p-8 pt-20 lg:pt-8 min-h-screen flex flex-col">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="w-full lg:w-auto">
            <h2 className="text-xl md:text-3xl font-bold tracking-tight truncate flex items-center gap-2">
              {pathname === '/admin' && "System Overview"}
              {pathname === '/admin/refunds' && "Refund Management"}
              {pathname === '/admin/search' && "Transaction Search"}
              {pathname === '/admin/transactions' && "Payment History"}
              {pathname === '/admin/settings' && "System Settings"}
              {pathname === '/admin/profile' && "My Profile"}
              {pathname === '/admin/logs' && "System Logs"}
              {pathname === '/admin/audit-logs' && "Audit Trail"}
              {pathname === '/admin/analytics' && "Analytics Dashboard"}
              {pathname === '/admin/customers' && "Customer Management"}
              {pathname === '/admin/statements' && "Account Statements"}
              {pathname === '/admin/security' && "Security Center"}
              {pathname === '/admin/users' && "User Management"}
              {pathname === '/admin/api-docs' && "API Documentation"}
              {pathname === '/admin/withdrawals' && "Withdrawal Management"}
              {pathname === '/admin/subscriptions' && "Subscription Plans"}
              {localStorage.getItem("userRole") === 'merchant' && (
                <span className="text-[10px] bg-bkash/10 text-bkash px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Merchant</span>
              )}
            </h2>
            <p className="text-zinc-500 text-xs md:text-sm mt-1">
              Welcome back, {localStorage.getItem("userName") || "Administrator"}
              {localStorage.getItem("userRole") === 'merchant' && localStorage.getItem("user") && (
                <span className="ml-2 text-zinc-400">({JSON.parse(localStorage.getItem("user") || "{}").merchant?.name})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input type="text" placeholder="Search..." className="w-full lg:w-64 bg-bkash-dark/50 border border-bkash-dark rounded-xl py-2 pl-9 pr-4 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBar />
              <Link to="/admin/profile" className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0 hover:border-bkash transition-colors">
                <img src={localStorage.getItem("userAvatar") || "https://picsum.photos/seed/admin/100/100"} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </Link>
            </div>
          </div>
        </header>
        <div className="flex-1">
          {children}
        </div>
      </main>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-bkash/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors theme="dark" />
        <Layout>
          <Routes>
            <Route path="/" element={<Checkout />} />
            <Route path="/merchant/register" element={<MerchantRegister />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/refunds" element={<Refunds />} />
            <Route path="/admin/search" element={<SearchTransaction />} />
            <Route path="/admin/transactions" element={<Transactions />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            <Route path="/admin/profile" element={<UserProfile />} />
            <Route path="/admin/logs" element={<LogsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/customers" element={<Customers />} />
            <Route path="/admin/statements" element={<Statements />} />
            <Route path="/admin/security" element={<Security />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/api-docs" element={<ApiDocs />} />
            <Route path="/admin/withdrawals" element={localStorage.getItem("userRole") === 'admin' ? <AdminWithdrawals /> : <Withdrawals />} />
            <Route path="/admin/subscriptions" element={localStorage.getItem("userRole") === 'admin' ? <AdminPlans /> : <Subscriptions />} />
            <Route path="/generate" element={<PaymentLinkGenerator />} />
            <Route path="/payment-success" element={<SuccessPage />} />
            <Route path="/payment-failed" element={<FailurePage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}
