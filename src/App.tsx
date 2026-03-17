import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, Link, useLocation, Navigate } from "react-router-dom";
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
  ZapOff,
  Smartphone,
  Shield,
  UserX,
  UserCheck,
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
import Installer from "./components/Installer";

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

const BkashLogo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <div className="w-11 h-11 bg-bkash rounded-2xl flex items-center justify-center shadow-xl shadow-bkash/30 rotate-3 hover:rotate-0 transition-transform duration-300">
      <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s" alt="bKash" className="w-7 h-7 object-contain brightness-0 invert" />
    </div>
    <div>
      <h1 className="font-black text-xl leading-none tracking-tighter text-bkash">bKash <span className="text-surface-900 dark:text-white">Pay</span></h1>
      <p className="text-[10px] text-surface-400 font-bold uppercase tracking-widest mt-1">Enterprise</p>
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
      active 
        ? "bg-bkash text-white shadow-lg shadow-bkash/25" 
        : "text-surface-500 dark:text-surface-400 hover:bg-bkash/5 dark:hover:bg-bkash/10 hover:text-bkash"
    )}
  >
    <Icon size={18} className={cn("transition-all duration-300", active ? "scale-110" : "group-hover:scale-110")} />
    <span className={cn("font-bold text-sm tracking-tight transition-all duration-300", active ? "translate-x-1" : "group-hover:translate-x-1")}>{label}</span>
    {active && (
      <motion.div 
        layoutId="active-indicator" 
        className="absolute left-0 w-1.5 h-6 bg-white rounded-r-full" 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
    )}
  </button>
);

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bkash-card p-6 group"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg", color || "bg-bkash shadow-bkash/20")}>
        <Icon className="text-white" size={24} />
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
          trend >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div>
      <p className="text-surface-500 dark:text-surface-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-surface-900 dark:text-white">{value}</h3>
    </div>
  </motion.div>
);

const TransactionRow = ({ tx }: { tx: Transaction, key?: string }) => (
  <tr className="group border-b border-surface-100 dark:border-surface-900 hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors">
    <td className="py-4 px-8">
      <div className="flex flex-col">
        <span className="text-surface-900 dark:text-white font-semibold text-sm">{tx.merchant_invoice || "N/A"}</span>
        <span className="text-surface-400 text-[10px] font-mono uppercase tracking-wider">{tx.payment_id}</span>
      </div>
    </td>
    <td className="py-4 px-8">
      <span className="text-surface-600 dark:text-surface-400 text-sm font-medium">{tx.customer_msisdn || "Pending"}</span>
    </td>
    <td className="py-4 px-8">
      <span className="text-surface-900 dark:text-white font-bold text-sm">{formatCurrency(tx.amount)}</span>
    </td>
    <td className="py-4 px-8">
      <span className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
        tx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : 
        tx.status === 'refunded' ? "bg-amber-500/10 text-amber-500" :
        tx.status === 'initiated' ? "bg-blue-500/10 text-blue-500" : "bg-rose-500/10 text-rose-500"
      )}>
        {tx.status === 'completed' ? <CheckCircle2 size={12} /> : 
         tx.status === 'refunded' ? <RotateCcw size={12} /> :
         tx.status === 'initiated' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
        {tx.status}
      </span>
    </td>
    <td className="py-4 px-8 text-right">
      <div className="flex justify-end items-center gap-3">
        <span className="text-surface-400 text-[10px] font-bold uppercase tracking-widest">{new Date(tx.created_at).toLocaleDateString()}</span>
        {tx.status === 'completed' && tx.payment_mode !== 'GLOBAL' && (
          <Link 
            to={`/admin/refunds?trx_id=${tx.trx_id}`}
            className="p-2 text-surface-400 hover:text-bkash hover:bg-bkash/5 rounded-lg transition-all"
            title="Refund"
          >
            <RotateCcw size={14} />
          </Link>
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Volume" value={formatCurrency(stats?.totalVolume || 0)} icon={TrendingUp} trend={12.5} color="bg-bkash" />
        <StatCard title="Success Payments" value={stats?.successCount || 0} icon={CheckCircle2} trend={8.2} color="bg-emerald-500" />
        <StatCard title="Failed Payments" value={stats?.failedCount || 0} icon={XCircle} trend={-1.4} color="bg-rose-500" />
        <StatCard title="Total Transactions" value={stats?.totalCount || 0} icon={Activity} color="bg-surface-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-xl tracking-tighter">Revenue Growth</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full" />
              <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">Revenue</span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'Mon', value: 4000 }, { name: 'Tue', value: 3000 }, { name: 'Wed', value: 5000 },
                { name: 'Thu', value: 2780 }, { name: 'Fri', value: 1890 }, { name: 'Sat', value: 2390 }, { name: 'Sun', value: 3490 },
              ]}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" dark:stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `৳${v}`} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '16px', backdropFilter: 'blur(8px)', color: '#fff' }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-8">
          <div className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-black text-xl tracking-tighter mb-8">Payment Methods</h3>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'bKash', value: 75 }, { name: 'Cards', value: 15 }, { name: 'Other', value: 10 }]} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value">
                    <Cell fill="#e2136e" stroke="none" /><Cell fill="#3b82f6" stroke="none" /><Cell fill="#a855f7" stroke="none" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-bkash rounded-full" />
                <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">bKash</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                <span className="text-[10px] font-bold text-surface-500 uppercase tracking-widest">Cards</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="font-black text-xl tracking-tighter mb-6 flex items-center gap-3">
              <div className="p-2 bg-bkash/10 rounded-xl">
                <Activity size={20} className="text-bkash" />
              </div>
              User Activity
            </h3>
            <div className="space-y-6">
              {stats?.userActivity?.map((log, i) => (
                <div key={i} className="relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-800 last:before:hidden">
                  <div className="absolute left-[-3px] top-1.5 w-2 h-2 bg-bkash rounded-full shadow-lg shadow-bkash/40" />
                  <p className="text-sm font-black text-surface-900 dark:text-white leading-none">{log.action}</p>
                  <p className="text-xs text-surface-500 mt-1.5 font-medium">{log.details}</p>
                  <p className="text-[10px] text-surface-400 mt-2 font-bold uppercase tracking-widest">{new Date(log.created_at).toLocaleTimeString()}</p>
                </div>
              ))}
              {(!stats?.userActivity || stats.userActivity.length === 0) && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-surface-100 dark:bg-surface-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <History className="text-surface-400" size={24} />
                  </div>
                  <p className="text-xs text-surface-500 font-bold uppercase tracking-widest">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-surface-100 dark:border-surface-900 flex justify-between items-center">
          <h3 className="font-black text-2xl tracking-tighter">Recent Transactions</h3>
          <Link to="/admin/transactions" className="bg-surface-100 dark:bg-surface-900 hover:bg-bkash hover:text-white text-surface-600 dark:text-surface-400 text-xs font-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 uppercase tracking-widest">
            View all <ChevronRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-50 dark:bg-surface-900/50 text-surface-400 text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="py-5 px-8">Invoice / ID</th>
                <th className="py-5 px-8">Customer</th>
                <th className="py-5 px-8">Amount</th>
                <th className="py-5 px-8">Status</th>
                <th className="py-5 px-8 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-900">
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-surface-50 dark:bg-surface-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-surface-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-surface-100 dark:border-surface-800">
          {/* bKash Header */}
          <div className="bg-bkash p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 shadow-lg">
                  <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s" alt="bKash" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tighter">bKash Payment</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Secure Gateway</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Amount</p>
                <p className="text-xl font-black tracking-tighter">৳{amount}</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-2">Invoice Number</label>
                <div className="bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-sm font-bold text-surface-900 dark:text-white">
                  {invoice || "Auto-generated"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-2">Payable Amount (BDT)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-surface-400">৳</span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="w-full bg-surface-50 dark:bg-surface-800 border-2 border-surface-100 dark:border-surface-800 rounded-[1.5rem] py-5 pl-12 pr-6 text-3xl font-black text-surface-900 dark:text-white focus:border-bkash focus:ring-0 transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleCheckout} 
                disabled={isProcessing || !isOnline} 
                className={cn(
                  "w-full font-black py-5 rounded-[1.5rem] shadow-xl transition-all flex items-center justify-center gap-3 text-lg",
                  isOnline 
                    ? "bg-bkash hover:bg-bkash-dark text-white shadow-bkash/25" 
                    : "bg-surface-200 dark:bg-surface-800 text-surface-400 cursor-not-allowed"
                )}
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : (
                  isOnline ? <>Pay with bKash <ChevronRight size={20} /></> : <>Offline: Connect to Pay</>
                )}
              </button>

              <div className="flex justify-center gap-4">
                <Link to="/admin/login" className="text-[10px] font-black uppercase tracking-widest text-surface-400 hover:text-bkash transition-colors">Admin Login</Link>
                <span className="text-surface-200 dark:text-surface-800">|</span>
                <Link to="/generate" className="text-[10px] font-black uppercase tracking-widest text-surface-400 hover:text-bkash transition-colors">Create Link</Link>
              </div>
            </div>

            {showManualRedirect && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                    Redirect blocked. Please click the button below to open the bKash payment page in a new tab.
                  </p>
                </div>
                <a 
                  href={bkashURL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20"
                >
                  Open Payment Page <ExternalLink size={16} />
                </a>
              </motion.div>
            )}
          </div>

          <div className="bg-surface-50 dark:bg-surface-800/50 p-6 text-center border-t border-surface-100 dark:border-surface-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-surface-400">Powered by bKash Enterprise</p>
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
        <div className="bg-surface-900 border border-surface-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="bg-bkash p-8 text-white">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center p-2">
                <Zap className="text-white" size={28} />
              </div>
              <h2 className="text-2xl font-black tracking-tight">Payment Link Generator</h2>
            </div>
            <p className="opacity-80 text-sm font-medium">Create a shareable link for your customers.</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest ml-1">Amount (BDT)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-surface-500">৳</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-surface-950 border border-surface-800 rounded-2xl py-4 pl-10 pr-4 text-xl font-bold text-white focus:border-bkash focus:outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest ml-1">Invoice (Optional)</label>
                <input 
                  type="text" 
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  className="w-full bg-surface-950 border border-surface-800 rounded-2xl py-4 px-4 text-sm font-medium text-white focus:border-bkash focus:outline-none transition-all"
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest ml-1">Merchant ID (Optional)</label>
              <input 
                type="text" 
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="w-full bg-surface-950 border border-surface-800 rounded-2xl py-4 px-4 text-sm font-medium text-white focus:border-bkash focus:outline-none transition-all"
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50 dark:bg-surface-950">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="w-full max-w-lg"
      >
        <div className="bg-white dark:bg-surface-900 rounded-[3rem] overflow-hidden shadow-2xl border border-surface-100 dark:border-surface-800">
          <div className="bg-bkash p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10" />
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
              className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"
            >
              <CheckCircle2 size={40} className="text-bkash" />
            </motion.div>
            <h2 className="relative z-10 text-2xl font-black text-white tracking-tighter">Payment Successful</h2>
          </div>
          
          <div className="p-8 md:p-12 space-y-8">
            <div className="text-center">
              <p className="text-surface-400 text-xs font-black uppercase tracking-widest mb-2">Amount Paid</p>
              <h3 className="text-5xl font-black text-surface-900 dark:text-white">
                <span className="text-bkash mr-2">৳</span>
                {parseFloat(amount || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="space-y-4 pt-4 border-t border-surface-100 dark:border-surface-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1 gap-1">
                <span className="text-surface-500 font-bold text-xs uppercase tracking-widest">Transaction ID</span>
                <span className="font-mono font-bold text-surface-900 dark:text-white text-sm break-all">{trxID}</span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1 gap-1">
                <span className="text-surface-500 font-bold text-xs uppercase tracking-widest">Date & Time</span>
                <span className="font-bold text-surface-900 dark:text-white text-sm">{formattedTime}</span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-1 gap-1">
                <span className="text-surface-500 font-bold text-xs uppercase tracking-widest">Customer</span>
                <span className="font-bold text-surface-900 dark:text-white text-sm">
                  {customer ? `Customer ${customer.slice(-4)}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-surface-500 font-bold text-xs uppercase tracking-widest">Invoice No</span>
                <span className="font-bold text-surface-900 dark:text-white">{invoice || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-surface-500 font-bold text-xs uppercase tracking-widest">Status</span>
                <span className="text-emerald-500 font-black uppercase tracking-wider text-sm">Completed</span>
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row gap-4">
              <Link 
                to="/" 
                className="flex-1 btn-secondary py-5 flex items-center justify-center gap-2"
              >
                <ArrowLeft size={18} /> Pay Again
              </Link>
              <button 
                onClick={() => generateReceipt({ trxID, amount, customer, invoice, time })}
                className="flex-1 btn-primary py-5 flex items-center justify-center gap-2"
              >
                <Download size={18} /> Receipt
              </button>
            </div>
          </div>
          
          <div className="bg-surface-50 dark:bg-surface-950 p-6 text-center border-t border-surface-100 dark:border-surface-800">
            <p className="text-surface-400 text-[10px] font-black uppercase tracking-[0.2em]">Thank you for using bKash</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const FailurePage = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error") || searchParams.get("status");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50 dark:bg-surface-950">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="w-full max-w-md text-center"
      >
        <div className="bg-white dark:bg-surface-900 rounded-[3rem] p-10 shadow-2xl border border-surface-100 dark:border-surface-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
          
          <div className="w-24 h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative">
            <XCircle className="text-rose-500 relative z-10" size={48} />
          </div>

          <h2 className="text-3xl font-black tracking-tighter text-surface-900 dark:text-white mb-2">Payment Failed</h2>
          <p className="text-surface-500 font-medium mb-8">We couldn't process your transaction at this time.</p>

          <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-6 mb-8 flex items-start gap-4 text-left">
            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Error Details</p>
              <p className="text-sm text-rose-600/80 dark:text-rose-400/80 font-medium">{error || "The payment was cancelled or declined by the user."}</p>
            </div>
          </div>

          <div className="space-y-4">
            <Link 
              to="/checkout" 
              className="block w-full btn-primary py-5"
            >
              Try Again
            </Link>
            <Link 
              to="/" 
              className="block w-full btn-secondary py-5"
            >
              Cancel
            </Link>
          </div>
        </div>
        <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-surface-400">Powered by bKash Enterprise</p>
      </motion.div>
    </div>
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-5 md:p-8 shadow-sm">
        <h3 className="font-black text-xl tracking-tighter mb-8 flex items-center gap-3">
          <div className="p-2 bg-bkash/10 rounded-xl">
            <Filter size={20} className="text-bkash" />
          </div>
          Filter Payments
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-1">Start Date</label>
            <input 
              type="date" 
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-1">End Date</label>
            <input 
              type="date" 
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-1">Search</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
              <input 
                type="text" 
                placeholder="TrxID, Invoice, Customer"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/20"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchTransactions}
              className="flex-1 bg-bkash hover:bg-bkash-dark text-white font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest shadow-lg shadow-bkash/20"
            >
              Filter
            </button>
            <button 
              onClick={() => {
                setFilters({ start_date: "", end_date: "", search: "" });
                setTimeout(fetchTransactions, 0);
              }}
              className="flex-1 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest"
            >
              Reset
            </button>
            <button 
              onClick={handleExport}
              className="p-3 bg-surface-100 dark:bg-surface-800 hover:bg-bkash hover:text-white text-surface-400 rounded-xl transition-all shrink-0"
              title="Export CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-surface-100 dark:border-surface-800 flex flex-col sm:row justify-between items-start sm:items-center gap-6">
          <h3 className="font-black text-2xl tracking-tighter">Transaction List</h3>
          <div className="text-left sm:text-right">
            <p className="text-[10px] text-surface-400 uppercase font-black tracking-widest mb-1">Total Volume</p>
            <p className="text-3xl font-black text-bkash tracking-tighter">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-surface-50 dark:bg-surface-950 text-surface-400 text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="py-5 px-8">Date / Time</th>
                <th className="py-5 px-8">Transaction ID</th>
                <th className="py-5 px-8">Amount</th>
                <th className="py-5 px-8">Customer</th>
                <th className="py-5 px-8">Status</th>
                <th className="py-5 px-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin inline-block mr-2 text-bkash" /> <span className="text-surface-400 font-bold uppercase tracking-widest text-xs">Loading records...</span></td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="group hover:bg-surface-50 dark:hover:bg-surface-950 transition-colors">
                  <td className="py-5 px-8 text-sm text-surface-500 font-medium">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="py-5 px-8 font-bold text-sm tracking-tight">{tx.trx_id || "PENDING"}</td>
                  <td className="py-5 px-8 font-black text-sm text-bkash">{formatCurrency(tx.amount)}</td>
                  <td className="py-5 px-8 text-sm text-surface-600 dark:text-surface-400 font-medium">{tx.customer_msisdn || "N/A"}</td>
                  <td className="py-5 px-8">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      tx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : 
                      tx.status === 'refunded' ? "bg-rose-500/10 text-rose-500" :
                      "bg-surface-100 dark:bg-surface-800 text-surface-400"
                    )}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-5 px-8 text-right">
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setSelectedTx(tx)}
                        className="p-2 text-surface-400 hover:text-bkash hover:bg-bkash/5 rounded-lg transition-all"
                        title="View Details"
                      >
                        <Info size={18} />
                      </button>
                      {tx.status === 'completed' && (
                        <Link 
                          to={`/admin/refunds?trx_id=${tx.trx_id}`}
                          className="p-2 text-surface-400 hover:text-bkash hover:bg-bkash/5 rounded-lg transition-all"
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
                <tr><td colSpan={6} className="py-20 text-center text-surface-400 font-bold uppercase tracking-widest text-xs">No transactions found</td></tr>
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
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50 dark:bg-surface-950">
                <h3 className="font-black text-2xl tracking-tighter">Transaction Details</h3>
                <button onClick={() => setSelectedTx(null)} className="p-2 text-surface-400 hover:text-bkash transition-colors"><X size={24} /></button>
              </div>
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-surface-400 uppercase font-black tracking-widest">Transaction ID</p>
                    <p className="font-bold text-surface-900 dark:text-white">{selectedTx.trx_id || "PENDING"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-surface-400 uppercase font-black tracking-widest">Status</p>
                    <span className={cn(
                      "inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      selectedTx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-100 dark:bg-surface-800 text-surface-400"
                    )}>
                      {selectedTx.status}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-surface-400 uppercase font-black tracking-widest">Amount</p>
                    <p className="text-2xl font-black text-bkash tracking-tighter">{formatCurrency(selectedTx.amount)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-surface-400 uppercase font-black tracking-widest">Date</p>
                    <p className="text-sm font-bold text-surface-700 dark:text-surface-300">{new Date(selectedTx.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-6 bg-surface-50 dark:bg-surface-950 rounded-3xl border border-surface-100 dark:border-surface-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-surface-400 font-bold uppercase tracking-widest">Customer</span>
                    <span className="font-bold text-surface-900 dark:text-white">{selectedTx.customer_msisdn || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-surface-400 font-bold uppercase tracking-widest">Invoice</span>
                    <span className="font-bold text-surface-900 dark:text-white">{selectedTx.merchant_invoice || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-surface-400 font-bold uppercase tracking-widest">Payment ID</span>
                    <span className="text-xs font-mono text-surface-500">{selectedTx.payment_id}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedTx(null)}
                  className="w-full bg-surface-900 dark:bg-white text-white dark:text-surface-900 font-black py-4 rounded-2xl transition-all hover:opacity-90 uppercase tracking-widest text-xs"
                >
                  Close Details
                </button>
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2 text-surface-900 dark:text-white">
            <Terminal size={20} className="text-bkash" />
            System Debug Logs
          </h3>
          <button onClick={() => window.location.reload()} className="text-xs text-surface-500 hover:text-bkash transition-colors">Refresh</button>
        </div>
        <div className="p-4 bg-surface-50 dark:bg-black/50 font-mono text-xs space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="animate-spin inline-block text-bkash" /></div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-surface-500">No logs found</div>
          ) : logs.map((log, i) => (
            <div key={i} className="border-b border-surface-100 dark:border-surface-800/50 pb-2 last:border-0">
              <div className="flex gap-4 text-surface-500 mb-1">
                <span className="text-bkash font-bold">[{log.level || 'INFO'}]</span>
                <span>{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <p className="text-surface-700 dark:text-surface-300">{log.message}</p>
              {log.details && (
                <pre className="mt-1 text-[10px] text-surface-500 overflow-x-auto">
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-surface-100 dark:border-surface-800">
          <h3 className="font-bold text-lg flex items-center gap-2 text-surface-900 dark:text-white">
            <Activity size={20} className="text-bkash" />
            Security Audit Trail
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-50 dark:bg-surface-950 text-surface-500 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="py-4 px-6 font-black">Timestamp</th>
                <th className="py-4 px-6 font-black">Action</th>
                <th className="py-4 px-6 font-black">User</th>
                <th className="py-4 px-6 font-black">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center"><Loader2 className="animate-spin inline-block text-bkash" /></td></tr>
              ) : logs.map((log, i) => (
                <tr key={i} className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                  <td className="py-4 px-6 text-xs text-surface-500">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-4 px-6"><span className="px-2 py-1 bg-bkash/10 text-bkash rounded text-[10px] font-bold uppercase">{log.action}</span></td>
                  <td className="py-4 px-6 text-sm font-medium text-surface-900 dark:text-white">{log.user}</td>
                  <td className="py-4 px-6 text-xs text-surface-500 dark:text-surface-400">{log.details}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-surface-500">No audit logs recorded</td></tr>
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-surface-50 dark:bg-surface-950 p-8 border-b border-surface-100 dark:border-surface-800">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="text-bkash" />
            System Configuration
          </h3>
          <p className="text-sm text-surface-500 mt-1 font-medium">Manage your bKash API credentials and application settings.</p>
        </div>
        
        <form onSubmit={handleSave} className="p-8 space-y-8">
          {userRole === 'admin' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest">API Credentials</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">App Key</label>
                    <input 
                      type="password" 
                      value={settings.BKASH_APP_KEY}
                      onChange={(e) => setSettings({...settings, BKASH_APP_KEY: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">App Secret</label>
                    <input 
                      type="password" 
                      value={settings.BKASH_APP_SECRET}
                      onChange={(e) => setSettings({...settings, BKASH_APP_SECRET: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Username</label>
                    <input 
                      type="text" 
                      value={settings.BKASH_USERNAME}
                      onChange={(e) => setSettings({...settings, BKASH_USERNAME: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Password</label>
                    <input 
                      type="password" 
                      value={settings.BKASH_PASSWORD}
                      onChange={(e) => setSettings({...settings, BKASH_PASSWORD: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs text-zinc-500 uppercase font-black tracking-widest">Environment Settings</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">bKash Base URL</label>
                    <input 
                      type="text" 
                      value={settings.BKASH_BASE_URL}
                      onChange={(e) => setSettings({...settings, BKASH_BASE_URL: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Application URL</label>
                    <input 
                      type="text" 
                      value={settings.APP_URL}
                      onChange={(e) => setSettings({...settings, APP_URL: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-surface-50 dark:bg-surface-950 p-6 rounded-2xl border border-surface-100 dark:border-surface-800">
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
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
                        : "bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 hover:border-bkash/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-surface-900 dark:text-white">Option 1: Global API</span>
                      {merchantSettings?.payment_mode === 'GLOBAL' && <CheckCircle2 className="text-bkash" size={20} />}
                    </div>
                    <p className="text-xs text-surface-500 leading-relaxed">Use the platform's shared bKash credentials. Ideal if you don't have your own bKash merchant API access yet.</p>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setMerchantSettings({...merchantSettings, payment_mode: 'OWN'})}
                    className={cn(
                      "p-6 rounded-2xl border text-left transition-all",
                      merchantSettings?.payment_mode === 'OWN' 
                        ? "bg-bkash/10 border-bkash ring-1 ring-bkash" 
                        : "bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 hover:border-bkash/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-surface-900 dark:text-white">Option 2: Own Credentials</span>
                      {merchantSettings?.payment_mode === 'OWN' && <CheckCircle2 className="text-bkash" size={20} />}
                    </div>
                    <p className="text-xs text-surface-500 leading-relaxed">Use your own bKash App Key, Secret, and credentials. You keep full control over your bKash account.</p>
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
                      <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Your App Key</label>
                      <input 
                        type="password" 
                        value={merchantSettings.bkash_app_key || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_app_key: e.target.value})}
                        className="input-field py-3"
                        placeholder="Enter your bKash App Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Your App Secret</label>
                      <input 
                        type="password" 
                        value={merchantSettings.bkash_app_secret || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_app_secret: e.target.value})}
                        className="input-field py-3"
                        placeholder="Enter your bKash App Secret"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Your bKash Username</label>
                      <input 
                        type="text" 
                        value={merchantSettings.bkash_username || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_username: e.target.value})}
                        className="input-field py-3"
                        placeholder="01XXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Your bKash Password</label>
                      <input 
                        type="password" 
                        value={merchantSettings.bkash_password || ""}
                        onChange={(e) => setMerchantSettings({...merchantSettings, bkash_password: e.target.value})}
                        className="input-field py-3"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="bg-surface-50 dark:bg-surface-950 p-6 rounded-2xl border border-surface-100 dark:border-surface-800">
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
                  <Key className="text-bkash" size={18} />
                  Your API Key
                </h4>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    readOnly
                    value={merchantSettings?.api_key || ""}
                    className="flex-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl px-4 py-3 text-sm font-mono text-surface-500 dark:text-surface-400"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(merchantSettings?.api_key || "");
                      toast.success("API Key copied to clipboard");
                    }}
                    className="px-4 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-xl transition-all text-surface-600 dark:text-surface-300"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                <p className="text-[10px] text-surface-400 mt-3">Use this key to integrate bKash payments into your own website or application.</p>
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
    
    const userRole = localStorage.getItem("userRole");
    const merchantId = localStorage.getItem("merchant_id");

    try {
      const payload = {
        paymentID: foundTx.payment_id,
        trxID: foundTx.trx_id,
        amount: refundForm.amount,
        sku: refundForm.sku,
        reason: refundForm.reason,
        userRole,
        merchantId
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
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-5 md:p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
              <Search size={20} className="text-bkash" />
              Search Transaction
            </h3>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="Enter Transaction ID (e.g. TST...)" 
                value={searchTrxId}
                onChange={(e) => setSearchTrxId(e.target.value)}
                className="input-field py-2.5"
              />
              <button 
                type="submit" 
                disabled={isSearching}
                className="bg-bkash hover:bg-bkash-dark disabled:bg-surface-200 dark:disabled:bg-surface-800 text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                Search
              </button>
            </form>

            {foundTx && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 p-5 bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-100 dark:border-surface-800 space-y-4">
                <h4 className="text-xs text-surface-500 uppercase font-black tracking-widest">Transaction Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase font-bold">Transaction ID</p>
                    <p className="font-bold text-sm text-surface-900 dark:text-white">{foundTx.trx_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase font-bold">Amount</p>
                    <p className="font-black text-bkash">{formatCurrency(foundTx.amount)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase font-bold">Customer</p>
                    <p className="text-sm text-surface-700 dark:text-surface-300">{foundTx.customer_msisdn || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase font-bold">Date</p>
                    <p className="text-xs text-surface-500">{new Date(foundTx.created_at).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[10px] text-surface-500 uppercase font-bold">Payment Mode</p>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                      foundTx.payment_mode === 'OWN' ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {foundTx.payment_mode === 'OWN' ? "Merchant's Own API" : "Global API"}
                    </span>
                  </div>
                </div>
                {localStorage.getItem("userRole") === 'admin' && foundTx.merchant_id && (
                  <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-rose-600 dark:text-rose-200/80 leading-relaxed">
                      <strong>Refund Restricted:</strong> Super Admin cannot process refunds for transactions belonging to merchants. Merchants must handle their own refunds.
                    </p>
                  </div>
                )}
                {localStorage.getItem("userRole") === 'merchant' && foundTx.payment_mode === 'OWN' && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-amber-600 dark:text-amber-200/80 leading-relaxed">
                      <strong>Refund Restricted:</strong> This transaction was processed using your own bKash credentials. Refunds must be handled directly through your bKash merchant panel.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Process Refund Form Card */}
          <div className={cn(
            "bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-5 md:p-6 shadow-sm transition-opacity duration-300",
            !foundTx && "opacity-50 pointer-events-none"
          )}>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
              <RotateCcw size={20} className="text-rose-500" />
              Process Refund
            </h3>
            <form onSubmit={handleRefund} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-surface-500 uppercase font-bold">Refund Amount <span className="text-rose-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="input-field py-2.5 focus:ring-rose-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-surface-500 uppercase font-bold">SKU (Optional)</label>
                  <input 
                    type="text" 
                    value={refundForm.sku}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="input-field py-2.5 focus:ring-rose-500/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-surface-500 uppercase font-bold">Reason (Optional)</label>
                <textarea 
                  rows={3}
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="input-field py-2.5 focus:ring-rose-500/50 resize-none"
                  placeholder="e.g. Customer requested refund"
                />
              </div>
              <button 
                type="submit" 
                disabled={
                  isProcessing || 
                  !foundTx || 
                  (localStorage.getItem("userRole") === 'admin' && foundTx.merchant_id) ||
                  (localStorage.getItem("userRole") === 'merchant' && foundTx.payment_mode === 'OWN')
                }
                className="w-full bg-bkash hover:bg-bkash-dark disabled:bg-surface-200 dark:disabled:bg-surface-800 text-white font-black py-4 rounded-xl shadow-xl shadow-bkash/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : (
                  (localStorage.getItem("userRole") === 'admin' && foundTx?.merchant_id) || 
                  (localStorage.getItem("userRole") === 'merchant' && foundTx?.payment_mode === 'OWN')
                  ? "Refund Restricted" 
                  : "Initiate Refund Request"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Recent Refunds Table */}
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2 text-surface-900 dark:text-white">
              <History size={20} className="text-bkash" />
              Recent Refund Requests
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-surface-50 dark:bg-surface-950 text-surface-500 text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="py-4 px-4 font-black">Refund ID</th>
                  <th className="py-4 px-4 font-black">Amount</th>
                  <th className="py-4 px-4 font-black">Status</th>
                  <th className="py-4 px-4 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((ref) => (
                  <tr key={ref.id} className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors group">
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-surface-900 dark:text-white font-bold text-sm">{ref.refund_id}</span>
                        <span className="text-surface-400 text-[10px] font-mono">{ref.original_trx_id}</span>
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
                        className="p-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-all text-surface-600 dark:text-surface-400"
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
              className="relative bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping opacity-20" />
                  <AlertCircle size={40} className="text-rose-500 relative z-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">Confirm Refund</h3>
                  <p className="text-surface-500 dark:text-surface-400 text-sm">
                    You are about to initiate a refund for this transaction. This action is irreversible.
                  </p>
                </div>
              </div>

              <div className="bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-100 dark:border-surface-800 p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-surface-100 dark:border-surface-800">
                  <span className="text-xs text-surface-500 font-bold uppercase tracking-wider">Refund Amount</span>
                  <span className="text-xl font-black text-rose-500">{formatCurrency(parseFloat(refundForm.amount) || 0)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase font-bold">TrxID</p>
                    <p className="text-xs font-mono text-surface-900 dark:text-white truncate">{foundTx?.trx_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase font-bold">SKU</p>
                    <p className="text-xs text-surface-900 dark:text-white truncate">{refundForm.sku || 'N/A'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-[10px] text-surface-500 uppercase font-bold">Reason</p>
                  <p className="text-xs text-surface-600 dark:text-surface-300 italic">"{refundForm.reason || 'No reason provided'}"</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  disabled={isProcessing}
                  onClick={() => setShowConfirmRefund(false)}
                  className="flex-1 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
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
              className="relative w-full max-w-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-[2rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50 dark:bg-surface-950">
                <div>
                  <h3 className="font-black text-2xl tracking-tight text-surface-900 dark:text-white">Refund Details</h3>
                  <p className="text-surface-500 text-sm font-medium">Detailed audit information for this request</p>
                </div>
                <button onClick={() => setSelectedRefund(null)} className="p-3 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-2xl text-surface-500 dark:text-surface-400 hover:text-bkash transition-all"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Refund ID</p>
                      <p className="font-mono text-sm text-bkash font-bold">{selectedRefund.refund_id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Original TrxID</p>
                      <p className="font-mono text-sm text-surface-900 dark:text-white">{selectedRefund.original_trx_id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Original Payment ID</p>
                      <p className="font-mono text-[10px] text-surface-500 dark:text-surface-400 break-all">{selectedRefund.original_payment_id}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Status</p>
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
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Refund Amount</p>
                      <p className="text-2xl font-black text-rose-500">{formatCurrency(selectedRefund.refund_amount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Requested Amount</p>
                      <p className="text-sm font-bold text-surface-600 dark:text-surface-300">{formatCurrency(selectedRefund.amount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">SKU / Reference</p>
                      <p className="text-sm font-medium text-surface-900 dark:text-white">{selectedRefund.sku || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Initiated By</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-[8px] font-black text-surface-900 dark:text-white">{selectedRefund.initiated_by?.[0]?.toUpperCase()}</div>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{selectedRefund.initiated_by}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-100 dark:border-surface-800 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Reason for Refund</p>
                    <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{selectedRefund.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-100 dark:border-surface-800">
                    <div className="space-y-1">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">IP Address</p>
                      <p className="text-xs font-mono text-surface-500 dark:text-surface-400">{selectedRefund.ip_address || 'N/A'}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Created At</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{new Date(selectedRefund.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Raw API Response</p>
                  <pre className="bg-surface-50 dark:bg-black p-5 rounded-2xl text-[10px] font-mono text-surface-500 overflow-x-auto border border-surface-100 dark:border-surface-800">
                    {JSON.stringify(JSON.parse(selectedRefund.response_data), null, 2)}
                  </pre>
                </div>
              </div>
              <div className="p-8 bg-surface-50 dark:bg-surface-950 border-t border-surface-100 dark:border-surface-800 flex justify-end">
                <button 
                  onClick={() => setSelectedRefund(null)}
                  className="px-10 py-4 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-2xl font-black text-sm transition-all"
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
              <h3 className="text-2xl font-black text-surface-900 dark:text-white">{currentSub.plan_name}</h3>
              <p className="text-surface-500 text-sm">Valid until {new Date(currentSub.end_date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-surface-900 px-6 py-4 rounded-2xl border border-surface-100 dark:border-surface-800 shadow-sm">
            <div className="text-[10px] text-surface-500 uppercase font-bold mb-1">Status</div>
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
            "bg-white dark:bg-surface-900 border rounded-3xl p-8 flex flex-col transition-all shadow-sm",
            currentSub?.plan_id === plan.id ? "border-bkash ring-4 ring-bkash/10" : "border-surface-200 dark:border-surface-800 hover:border-bkash/50"
          )}>
            <div className="mb-8">
              <h4 className="text-xl font-black mb-2 text-surface-900 dark:text-white">{plan.name}</h4>
              <p className="text-surface-500 text-sm leading-relaxed">{plan.description}</p>
            </div>
            <div className="mb-8">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-surface-900 dark:text-white">৳{plan.price}</span>
                <span className="text-surface-500 text-sm">/{plan.duration_days} days</span>
              </div>
            </div>
            <div className="space-y-4 mb-8 flex-1">
              {JSON.parse(plan.features || '[]').map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400">
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
                  ? "bg-surface-100 dark:bg-surface-800 text-surface-400 cursor-not-allowed" 
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
        toast.success("Plan created successfully");
        setShowAdd(false);
        setNewPlan({ name: '', description: '', price: '', duration_days: '30', features: '' });
        fetchData();
      }
    } catch (err) {
      toast.error("Failed to create plan");
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-3xl md:text-5xl font-black tracking-tighter">Subscription Plans</h3>
          <p className="text-surface-500 font-medium mt-2">Manage your service offerings and merchant tiers.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-3 w-full md:w-auto justify-center">
          <Plus size={24} /> Create New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {plans.map(plan => (
          <motion.div 
            key={plan.id} 
            whileHover={{ y: -10 }}
            className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[2.5rem] p-10 shadow-sm hover:shadow-2xl hover:shadow-bkash/5 transition-all duration-500 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-bkash/5 rounded-bl-[5rem] -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150" />
            
            <div className="relative">
              <div className="flex justify-between items-start mb-8">
                <div className="p-4 bg-bkash/10 rounded-2xl">
                  <Zap className="text-bkash" size={32} />
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black tracking-tighter text-bkash">৳{plan.price}</div>
                  <div className="text-[10px] font-black text-surface-400 uppercase tracking-widest mt-1">Per {plan.duration_days} Days</div>
                </div>
              </div>
              
              <h4 className="text-2xl font-black tracking-tight mb-3 group-hover:text-bkash transition-colors">{plan.name}</h4>
              <p className="text-surface-500 text-sm font-medium mb-8 leading-relaxed">{plan.description}</p>
              
              <div className="space-y-4 pt-8 border-t border-surface-100 dark:border-surface-900">
                <p className="text-[10px] font-black text-surface-400 uppercase tracking-widest">What's included</p>
                {JSON.parse(plan.features || '[]').map((f: string, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                      <Check size={12} className="text-emerald-500" />
                    </div>
                    <span className="text-sm font-bold text-surface-700 dark:text-surface-300">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full py-20 bg-surface-100 dark:bg-surface-900/50 rounded-[3rem] border-2 border-dashed border-surface-200 dark:border-surface-800 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-surface-200 dark:bg-surface-800 rounded-[2rem] flex items-center justify-center mb-6">
              <Zap className="text-surface-400" size={40} />
            </div>
            <h4 className="text-xl font-black tracking-tight mb-2">No Plans Created Yet</h4>
            <p className="text-surface-500 font-medium max-w-xs">Start by creating your first subscription plan to monetize your platform.</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[3rem] overflow-hidden shadow-sm">
        <div className="p-10 border-b border-surface-100 dark:border-surface-900 flex justify-between items-center bg-surface-50/50 dark:bg-surface-900/30">
          <div>
            <h3 className="text-2xl font-black tracking-tighter">Merchant Subscriptions</h3>
            <p className="text-sm text-surface-500 font-medium mt-1">Monitor active subscriptions across your merchant network.</p>
          </div>
          <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-2xl">
            <Users className="text-surface-400" size={24} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-50 dark:bg-surface-900/50 text-surface-400 text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="py-6 px-10">Merchant Details</th>
                <th className="py-6 px-10">Plan Details</th>
                <th className="py-6 px-10">Status</th>
                <th className="py-6 px-10 text-right">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-900">
              {merchantSubs.map(sub => (
                <tr key={sub.id} className="group hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors">
                  <td className="py-6 px-10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-bkash/10 rounded-xl flex items-center justify-center text-bkash font-black text-sm">
                        {sub.merchant_name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-surface-900 dark:text-white tracking-tight">{sub.merchant_name}</div>
                        <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest mt-0.5">{sub.merchant_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-10">
                    <div className="text-sm font-black text-surface-900 dark:text-white tracking-tight">{sub.plan_name}</div>
                    <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest mt-0.5">৳{sub.price} / {sub.duration_days} Days</div>
                  </td>
                  <td className="py-6 px-10">
                    <span className={cn(
                      "text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest border transition-all duration-300",
                      sub.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-surface-100 dark:bg-surface-800 text-surface-500 border-surface-200 dark:border-surface-700"
                    )}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="py-6 px-10 text-right">
                    <div className="text-sm font-black text-surface-900 dark:text-white tracking-tight">{new Date(sub.end_date).toLocaleDateString()}</div>
                    <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest mt-0.5">Valid Until</div>
                  </td>
                </tr>
              ))}
              {merchantSubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="w-16 h-16 bg-surface-100 dark:bg-surface-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <ZapOff className="text-surface-400" size={32} />
                    </div>
                    <p className="text-sm text-surface-500 font-bold uppercase tracking-widest">No active subscriptions found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="w-full max-w-xl bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[3rem] p-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black tracking-tighter">Create New Plan</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-900 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-surface-500 uppercase tracking-widest ml-1">Plan Name</label>
                  <input type="text" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="input-field" placeholder="e.g. Professional Tier" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-surface-500 uppercase tracking-widest ml-1">Description</label>
                  <textarea value={newPlan.description} onChange={e => setNewPlan({...newPlan, description: e.target.value})} className="input-field h-24" placeholder="Describe the plan benefits..." required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-surface-500 uppercase tracking-widest ml-1">Price (BDT)</label>
                    <input type="number" value={newPlan.price} onChange={e => setNewPlan({...newPlan, price: e.target.value})} className="input-field" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-surface-500 uppercase tracking-widest ml-1">Duration (Days)</label>
                    <input type="number" value={newPlan.duration_days} onChange={e => setNewPlan({...newPlan, duration_days: e.target.value})} className="input-field" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-surface-500 uppercase tracking-widest ml-1">Features (Comma separated)</label>
                  <input type="text" value={newPlan.features} onChange={e => setNewPlan({...newPlan, features: e.target.value})} className="input-field" placeholder="Feature 1, Feature 2..." required />
                </div>
                <div className="flex gap-3 pt-4 md:col-span-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-bold py-3 rounded-xl transition-all">Cancel</button>
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
        toast.success(`Withdrawal ${status.toLowerCase()} successfully`);
        fetchWithdrawals();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[2.5rem] overflow-hidden shadow-sm">
      <div className="p-10 border-b border-surface-100 dark:border-surface-900 flex justify-between items-center bg-surface-50/50 dark:bg-surface-900/30">
        <div>
          <h3 className="text-2xl font-black tracking-tighter">Withdrawal Requests</h3>
          <p className="text-sm text-surface-500 font-medium mt-1">Review and process merchant payout requests.</p>
        </div>
        <div className="p-3 bg-surface-100 dark:bg-surface-800 rounded-2xl">
          <Wallet className="text-surface-400" size={24} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-surface-50 dark:bg-surface-900/50 text-surface-400 text-[10px] uppercase tracking-widest font-black">
            <tr>
              <th className="py-6 px-10">Merchant</th>
              <th className="py-6 px-10">Account Info</th>
              <th className="py-6 px-10">Amount</th>
              <th className="py-6 px-10">Status</th>
              <th className="py-6 px-10 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-900">
            {withdrawals.map(w => (
              <tr key={w.id} className="group hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors">
                <td className="py-6 px-10">
                  <div className="text-sm font-black text-surface-900 dark:text-white tracking-tight">{w.merchant_name}</div>
                  <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest mt-0.5">{new Date(w.created_at).toLocaleString()}</div>
                </td>
                <td className="py-6 px-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-100 dark:bg-surface-800 rounded-lg flex items-center justify-center text-surface-400">
                      {w.account_type === 'BANK' ? <Building2 size={16} /> : <Smartphone size={16} />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-surface-700 dark:text-surface-300 uppercase tracking-tight">{w.provider} ({w.account_type})</div>
                      <div className="text-[10px] text-surface-500 font-mono mt-0.5">{w.account_number}</div>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-10">
                  <div className="text-sm font-black text-surface-900 dark:text-white tracking-tight">৳{w.amount.toLocaleString()}</div>
                  <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest mt-0.5">Payout Amount</div>
                </td>
                <td className="py-6 px-10">
                  <span className={cn(
                    "text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest border transition-all duration-300",
                    w.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    w.status === 'PENDING' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                    w.status === 'REJECTED' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                    "bg-surface-100 dark:bg-surface-800 text-surface-500 border-surface-200 dark:border-surface-700"
                  )}>
                    {w.status}
                  </span>
                </td>
                <td className="py-6 px-10 text-right">
                  {w.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleStatus(w.id, 'COMPLETED')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all active:scale-95">Approve</button>
                      <button onClick={() => handleStatus(w.id, 'REJECTED')} className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all active:scale-95">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="w-16 h-16 bg-surface-100 dark:bg-surface-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Wallet className="text-surface-400" size={32} />
                  </div>
                  <p className="text-sm text-surface-500 font-bold uppercase tracking-widest">No withdrawal requests found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MerchantManagement = () => {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPermissions, setEditingPermissions] = useState<any>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const fetchMerchants = async () => {
    try {
      const res = await fetch("/api/admin/merchants");
      const data = await res.json();
      setMerchants(data);
    } catch (err) {
      toast.error("Failed to fetch merchants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/merchants/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) {
        toast.success(`Merchant ${status.toLowerCase()}`);
        fetchMerchants();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleKycVerify = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/merchants/kyc-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) {
        toast.success(`KYC ${status.toLowerCase()}`);
        fetchMerchants();
      }
    } catch (err) {
      toast.error("Failed to verify KYC");
    }
  };

  const openPermissions = (merchant: any) => {
    setEditingPermissions(merchant);
    setSelectedPermissions(merchant.permissions ? JSON.parse(merchant.permissions) : []);
  };

  const savePermissions = async () => {
    try {
      const res = await fetch("/api/admin/merchants/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingPermissions.id, permissions: selectedPermissions })
      });
      if (res.ok) {
        toast.success("Permissions updated");
        setEditingPermissions(null);
        fetchMerchants();
      }
    } catch (err) {
      toast.error("Failed to update permissions");
    }
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const allTabs = [
    'dashboard', 'transactions', 'search', 'refunds', 'logs', 'audit-logs', 
    'profile', 'analytics', 'customers', 'statements', 'security', 
    'user-management', 'api-docs', 'withdrawals', 'subscriptions', 'settings'
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-bkash" /></div>;

  return (
    <div className="space-y-8">
      <div className="bg-bkash-dark/50 border border-bkash-dark rounded-3xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-bkash-dark">
          <h3 className="font-bold text-lg">Merchant Management</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-50 dark:bg-surface-900/50 text-surface-400 text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="py-6 px-10">Merchant Details</th>
                <th className="py-6 px-10">KYC Status</th>
                <th className="py-6 px-10">Account Status</th>
                <th className="py-6 px-10 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {merchants.map(m => (
                <tr key={m.id} className="group hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors">
                  <td className="py-6 px-10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-bkash/10 rounded-xl flex items-center justify-center text-bkash font-black text-sm">
                        {m.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-surface-900 dark:text-white tracking-tight">{m.name}</div>
                        <div className="text-[10px] text-surface-500 font-bold uppercase tracking-widest mt-0.5">{m.email}</div>
                        <div className="mt-2 flex gap-2">
                          <span className="text-[9px] bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-lg text-surface-500 font-black uppercase tracking-tighter border border-surface-200 dark:border-surface-700">{m.payment_mode} API</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-10">
                    <div className="flex flex-col gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest border transition-all duration-300 w-fit",
                        m.kyc_status === 'VERIFIED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        m.kyc_status === 'SUBMITTED' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        m.kyc_status === 'REJECTED' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                        "bg-surface-100 dark:bg-surface-800 text-surface-500 border-surface-200 dark:border-surface-700"
                      )}>
                        {m.kyc_status}
                      </span>
                      {m.kyc_details && (
                        <button 
                          onClick={() => alert(`KYC Details:\n${JSON.stringify(JSON.parse(m.kyc_details), null, 2)}`)}
                          className="text-[10px] text-bkash hover:underline font-black uppercase tracking-widest text-left ml-1"
                        >
                          View Documents
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-6 px-10">
                    <span className={cn(
                      "text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest border transition-all duration-300",
                      m.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    )}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openPermissions(m)} className="p-2 text-zinc-400 hover:text-white transition-colors" title="Permissions">
                        <ShieldCheck size={16} />
                      </button>
                      {m.kyc_status === 'SUBMITTED' && (
                        <>
                          <button onClick={() => handleKycVerify(m.id, 'VERIFIED')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all">Verify KYC</button>
                          <button onClick={() => handleKycVerify(m.id, 'REJECTED')} className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all">Reject KYC</button>
                        </>
                      )}
                      <button 
                        onClick={() => handleStatus(m.id, m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                        className={cn(
                          "text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all",
                          m.status === 'ACTIVE' ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                        )}
                      >
                        {m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {editingPermissions && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black">Manage Permissions</h3>
                  <p className="text-xs text-zinc-500">{editingPermissions.name}</p>
                </div>
                <button onClick={() => setEditingPermissions(null)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {allTabs.map(tab => (
                  <button 
                    key={tab}
                    onClick={() => togglePermission(tab)}
                    className={cn(
                      "px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                      selectedPermissions.includes(tab) 
                        ? "bg-bkash/10 border-bkash text-bkash" 
                        : "bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    <span className="capitalize">{tab.replace('-', ' ')}</span>
                    {selectedPermissions.includes(tab) && <Check size={14} />}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setEditingPermissions(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-all">Cancel</button>
                <button onClick={savePermissions} className="flex-1 bg-bkash hover:bg-bkash/90 text-white font-black py-4 rounded-xl shadow-xl shadow-bkash/20 transition-all">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const KYCVerification = () => {
  const [kyc, setKyc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nid: '',
    passport: '',
    trade_license: '',
    contact_number: ''
  });
  const merchantId = localStorage.getItem("merchant_id");

  const fetchKyc = async () => {
    try {
      const res = await fetch(`/api/merchant/kyc?merchantId=${merchantId}`);
      const data = await res.json();
      setKyc(data);
      if (data.kyc_details) {
        setForm(JSON.parse(data.kyc_details));
      }
    } catch (err) {
      toast.error("Failed to fetch KYC status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKyc();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/merchant/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, details: form })
      });
      if (res.ok) {
        toast.success("KYC submitted for verification successfully");
        fetchKyc();
      }
    } catch (err) {
      toast.error("Failed to submit KYC");
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-16 h-16 border-4 border-bkash/20 border-t-bkash rounded-full animate-spin" />
      <p className="text-sm font-black text-surface-500 uppercase tracking-widest">Loading Verification Status...</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-surface-900 rounded-[3rem] overflow-hidden shadow-sm"
      >
        <div className="bg-bkash p-12 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-6 mb-4">
              <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-black/10">
                <ShieldCheck className="text-bkash" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tighter">KYC Verification</h2>
                <p className="opacity-80 text-sm font-bold uppercase tracking-widest mt-1">Identity & Business Verification</p>
              </div>
            </div>
            <p className="opacity-70 text-sm font-medium max-w-md">Complete your profile verification to unlock higher transaction limits and premium features.</p>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="p-12">
          {kyc?.kyc_status === 'VERIFIED' ? (
            <div className="text-center py-16 space-y-6">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/5">
                <CheckCircle2 className="text-emerald-500" size={56} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black tracking-tighter">Identity Verified</h3>
                <p className="text-surface-500 font-medium text-lg">Your account is fully verified. You have access to all features.</p>
              </div>
              <div className="pt-6">
                <span className="bg-emerald-500/10 text-emerald-500 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                  Verified Merchant
                </span>
              </div>
            </div>
          ) : kyc?.kyc_status === 'SUBMITTED' ? (
            <div className="text-center py-16 space-y-6">
              <div className="w-24 h-24 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-amber-500/5">
                <Clock className="text-amber-500" size={56} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black tracking-tighter">Verification Pending</h3>
                <p className="text-surface-500 font-medium text-lg">Our compliance team is currently reviewing your documents.</p>
              </div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Estimated time: 24-48 hours</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10">
              {kyc?.kyc_status === 'REJECTED' && (
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="p-6 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-start gap-4"
                >
                  <AlertCircle className="text-rose-500 shrink-0 mt-1" size={24} />
                  <div>
                    <h4 className="text-rose-500 font-black text-sm uppercase tracking-widest mb-1">Verification Rejected</h4>
                    <p className="text-sm text-surface-600 dark:text-surface-400 font-medium leading-relaxed">Your previous attempt was not successful. Please ensure all documents are clear and valid before resubmitting.</p>
                  </div>
                </motion.div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-surface-500 uppercase tracking-[0.2em] ml-1">National ID Number</label>
                  <input 
                    type="text" 
                    value={form.nid} 
                    onChange={e => setForm({...form, nid: e.target.value})} 
                    className="input-field py-5" 
                    placeholder="Enter your 10 or 17 digit NID"
                    required 
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-surface-500 uppercase tracking-[0.2em] ml-1">Passport Number (Optional)</label>
                  <input 
                    type="text" 
                    value={form.passport} 
                    onChange={e => setForm({...form, passport: e.target.value})} 
                    className="input-field py-5" 
                    placeholder="Enter passport number if available"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-surface-500 uppercase tracking-[0.2em] ml-1">Trade License Number</label>
                <input 
                  type="text" 
                  value={form.trade_license} 
                  onChange={e => setForm({...form, trade_license: e.target.value})} 
                  className="input-field py-5" 
                  placeholder="Enter your business trade license number"
                  required 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-surface-500 uppercase tracking-[0.2em] ml-1">Contact Number</label>
                <input 
                  type="tel" 
                  value={form.contact_number} 
                  onChange={e => setForm({...form, contact_number: e.target.value})} 
                  className="input-field py-5" 
                  placeholder="+880 1XXX XXXXXX"
                  required 
                />
              </div>

              <button type="submit" className="btn-primary w-full py-6 text-sm uppercase tracking-widest flex items-center justify-center gap-4">
                Submit for Verification <ShieldCheck size={24} />
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const PayoutAccounts = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAccount, setNewAccount] = useState({
    provider: 'bKash',
    type: 'PERSONAL',
    account_number: '',
    account_name: '',
    bank_name: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/merchant/payout-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, ...newAccount })
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

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-bkash" /></div>;

  return (
    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-6 space-y-6 shadow-sm">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Payout Accounts</h3>
        <button onClick={() => setShowAdd(true)} className="p-2 bg-bkash/10 text-bkash rounded-xl hover:bg-bkash hover:text-white transition-all">
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-3">
        {accounts.map(acc => (
          <div key={acc.id} className="p-4 bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800 rounded-2xl flex justify-between items-center group">
            <div>
              <div className="text-sm font-bold">{acc.provider} ({acc.type})</div>
              <div className="text-xs text-surface-500 font-mono">{acc.account_number}</div>
            </div>
            <button onClick={() => handleDelete(acc.id)} className="p-2 text-surface-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="text-center py-6 text-surface-500 text-sm">No payout accounts added.</div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-xl font-black mb-6 text-surface-900 dark:text-white">Add Payout Account</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-surface-500 uppercase">Provider</label>
                    <select value={newAccount.provider} onChange={e => setNewAccount({...newAccount, provider: e.target.value})} className="input-field py-3">
                      <option value="bKash">bKash</option>
                      <option value="Nagad">Nagad</option>
                      <option value="Rocket">Rocket</option>
                      <option value="Bank">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-surface-500 uppercase">Type</label>
                    <select value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value})} className="input-field py-3">
                      <option value="PERSONAL">Personal</option>
                      <option value="AGENT">Agent</option>
                      <option value="MERCHANT">Merchant</option>
                      <option value="BANK">Bank Account</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-surface-500 uppercase">Account Number</label>
                  <input type="text" value={newAccount.account_number} onChange={e => setNewAccount({...newAccount, account_number: e.target.value})} className="input-field py-3" required />
                </div>

                {newAccount.type === 'BANK' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-surface-500 uppercase">Account Name</label>
                      <input type="text" value={newAccount.account_name} onChange={e => setNewAccount({...newAccount, account_name: e.target.value})} className="input-field py-3" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-surface-500 uppercase">Bank Name</label>
                        <input type="text" value={newAccount.bank_name} onChange={e => setNewAccount({...newAccount, bank_name: e.target.value})} className="input-field py-3" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-surface-500 uppercase">Routing No</label>
                        <input type="text" value={newAccount.routing_number} onChange={e => setNewAccount({...newAccount, routing_number: e.target.value})} className="input-field py-3" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-bold py-3 rounded-xl transition-all">Cancel</button>
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-[2.5rem] p-8 shadow-sm">
        <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center">
          <ShieldAlert className="text-amber-500" size={48} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black tracking-tight text-surface-900 dark:text-white">Withdrawals Unavailable</h3>
          <p className="text-surface-500 max-w-md mx-auto font-medium">
            You are currently using your own bKash API credentials. Payments are settled directly to your merchant account by bKash. Withdrawals are only required when using our Global API mode.
          </p>
        </div>
        <button 
          onClick={() => window.location.href = '/admin/settings'}
          className="bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-bold px-8 py-3 rounded-2xl transition-all"
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

        <div className="lg:col-span-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center">
            <h3 className="font-bold text-lg">Withdrawal History</h3>
            <RefreshCcw size={18} className="text-surface-400 cursor-pointer hover:text-bkash transition-colors" onClick={fetchData} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-50 dark:bg-surface-950 text-surface-400 text-[10px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Account</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {withdrawals.map(w => (
                  <tr key={w.id} className="hover:bg-surface-50 dark:hover:bg-surface-950 transition-colors">
                    <td className="py-4 px-6 text-xs text-surface-500">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-bold">{w.provider}</div>
                      <div className="text-[10px] text-surface-500 font-mono">{w.account_number}</div>
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-xl font-black mb-6 text-surface-900 dark:text-white">Request Withdrawal</h3>
              <form onSubmit={handleRequest} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-surface-500 uppercase">Amount to Withdraw</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-surface-400">৳</span>
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-2xl py-4 pl-10 pr-4 text-2xl font-bold text-surface-900 dark:text-white focus:outline-none focus:border-bkash"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="text-[10px] text-surface-500 text-right">Max: ৳{balance.toLocaleString()}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-surface-500 uppercase">Select Payout Account</label>
                  <div className="space-y-2">
                    {accounts.map(acc => (
                      <label key={acc.id} className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                        selectedAccount === acc.id ? "bg-bkash/10 border-bkash" : "bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 hover:border-bkash/30"
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
                          selectedAccount === acc.id ? "border-bkash" : "border-surface-300 dark:border-surface-700"
                        )}>
                          {selectedAccount === acc.id && <div className="w-2 h-2 bg-bkash rounded-full" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-surface-900 dark:text-white">{acc.provider} ({acc.account_number})</div>
                          <div className="text-[10px] text-surface-500">{acc.account_name}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowRequest(false)} className="flex-1 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-bold py-3 rounded-xl transition-all">Cancel</button>
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
        <h3 className="text-2xl font-black mb-4 flex items-center gap-3 text-white">
          <BookOpen className="text-bkash" size={28} />
          Merchant API Documentation
        </h3>
        <p className="text-surface-400 leading-relaxed max-w-3xl">
          Integrate bKash payments into your website or application using our simple REST API. 
          Whether you use our Global API or your own credentials, the integration process remains the same.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-lg mb-4 text-surface-900 dark:text-white">1. Authentication</h4>
            <p className="text-sm text-surface-500 mb-4">All API requests must include your API Key in the headers.</p>
            <div className="bg-surface-950 rounded-xl p-4 font-mono text-xs text-emerald-500 overflow-x-auto">
              Authorization: Bearer {apiKey}
            </div>
          </div>

          <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-lg mb-4 text-surface-900 dark:text-white">2. Create Payment</h4>
            <p className="text-sm text-surface-500 mb-4">Endpoint to initiate a bKash payment session.</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Post</span>
                <span className="text-xs font-mono text-surface-400">{appUrl}/api/bkash/create-payment</span>
              </div>
              <div className="bg-surface-950 rounded-xl p-4 font-mono text-xs text-surface-300 overflow-x-auto">
                {`{
  "amount": "100.00",
  "invoice": "INV-123456",
  "merchantId": "${merchantId || 'YOUR_MERCHANT_ID'}"
}`}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm">
          <h4 className="font-bold text-lg mb-4 flex items-center justify-between text-surface-900 dark:text-white">
            Try It Now
            <span className="text-[10px] bg-bkash/10 text-bkash px-2 py-1 rounded-full uppercase tracking-widest">Sandbox</span>
          </h4>
          <p className="text-sm text-surface-500 mb-6">Test the payment flow directly from this documentation.</p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-surface-500 uppercase tracking-widest">Test Amount</label>
              <input type="number" defaultValue="10" className="input-field py-3" />
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

          <div className="mt-8 pt-8 border-t border-surface-100 dark:border-surface-800">
            <h5 className="font-bold text-sm mb-4 text-surface-900 dark:text-white">Integration Modes</h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-50 dark:bg-surface-950 rounded-xl border border-surface-100 dark:border-surface-800">
                <div className="text-bkash font-bold text-xs mb-1">Global Mode</div>
                <p className="text-[10px] text-surface-500">No bKash merchant account needed. Withdraw balance to your MFS/Bank.</p>
              </div>
              <div className="p-4 bg-surface-50 dark:bg-surface-950 rounded-xl border border-surface-100 dark:border-surface-800">
                <div className="text-blue-500 font-bold text-xs mb-1">Own Mode</div>
                <p className="text-[10px] text-surface-500">Use your own bKash credentials. Money goes directly to your account.</p>
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50 dark:bg-surface-950 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-bkash/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white dark:bg-surface-900 rounded-[3rem] p-10 shadow-2xl border border-surface-100 dark:border-surface-800">
          <div className="text-center mb-10">
            <BkashLogo className="justify-center mb-6" />
            <h2 className="text-2xl font-black tracking-tighter text-surface-900 dark:text-white">Merchant Portal</h2>
            <p className="text-sm text-surface-500 font-medium mt-1">Sign in to manage your business</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-2">Username</label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
                <input 
                  type="text" 
                  required 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-bkash focus:ring-0 transition-all" 
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-surface-400">Password</label>
                <button 
                  type="button" 
                  onClick={() => setShowForgotModal(true)}
                  className="text-[10px] font-black uppercase tracking-widest text-bkash hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-bkash focus:ring-0 transition-all" 
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <input 
                type="checkbox" 
                id="remember" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-surface-200 text-bkash focus:ring-bkash"
              />
              <label htmlFor="remember" className="text-xs text-surface-500 font-medium cursor-pointer">Remember me</label>
            </div>

            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full btn-primary py-5 rounded-2xl"
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-surface-100 dark:border-surface-800 text-center">
            <p className="text-xs text-surface-500 font-medium">
              Don't have a merchant account?{" "}
              <Link to="/merchant/register" className="text-bkash font-black hover:underline">Register Now</Link>
            </p>
          </div>
        </div>
        <p className="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-surface-400">© 2026 bKash Enterprise Solutions</p>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-surface-900 rounded-[2.5rem] p-8 w-full max-w-sm border border-surface-100 dark:border-surface-800"
            >
              <h3 className="text-xl font-black tracking-tighter mb-2">Reset Password</h3>
              <p className="text-sm text-surface-500 mb-6">Enter your email to receive a reset link.</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input 
                  type="email" 
                  required 
                  value={forgotEmail} 
                  onChange={(e) => setForgotEmail(e.target.value)} 
                  className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-800 rounded-xl py-3 px-4 text-sm font-bold" 
                  placeholder="email@example.com"
                />
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 btn-secondary py-3"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isForgotLoading}
                    className="flex-1 btn-primary py-3"
                  >
                    {isForgotLoading ? <Loader2 className="animate-spin mx-auto" /> : "Send Link"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-bkash" />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-bkash rounded-3xl flex items-center justify-center shadow-2xl shadow-bkash/30 mb-6 rotate-3">
            <UserPlus className="text-white" size={40} />
          </div>
          <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tight">Merchant Sign Up</h2>
          <p className="text-surface-500 font-medium mt-2 text-center">Start accepting bKash payments today.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest ml-1">Business Name</label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-bkash transition-colors" size={18} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field py-4 pl-12" 
                  placeholder="Acme Corp"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-bkash transition-colors" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field py-4 pl-12" 
                  placeholder="merchant@example.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-bkash transition-colors" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field py-4 pl-12" 
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full btn-primary py-4 rounded-xl"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Create Merchant Account"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-surface-500">
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="h-32 bg-gradient-to-r from-bkash to-rose-400" />
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6 flex justify-between items-end">
            <div className="relative group">
              <div className="h-32 w-32 rounded-3xl bg-surface-100 dark:bg-surface-800 border-4 border-white dark:border-surface-900 overflow-hidden shadow-xl">
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
                className="bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm"
              >
                <Settings size={18} /> Edit Profile
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Full Name</label>
                <input 
                  type="text" 
                  disabled={!isEditing}
                  value={user.name}
                  onChange={(e) => setUser({...user, name: e.target.value})}
                  className="input-field py-3 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Email Address</label>
                <input 
                  type="email" 
                  disabled={!isEditing}
                  value={user.email}
                  onChange={(e) => setUser({...user, email: e.target.value})}
                  className="input-field py-3 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Phone Number</label>
                <input 
                  type="tel" 
                  disabled={!isEditing}
                  value={user.phone}
                  onChange={(e) => setUser({...user, phone: e.target.value})}
                  className="input-field py-3 disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Avatar URL</label>
                <input 
                  type="url" 
                  disabled={!isEditing}
                  value={user.avatar}
                  onChange={(e) => setUser({...user, avatar: e.target.value})}
                  className="input-field py-3 disabled:opacity-50"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-4 pt-4">
                <button 
                  type="submit"
                  className="bg-bkash hover:bg-bkash-dark text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-bkash/20 transition-all uppercase tracking-widest text-xs"
                >
                  Save Changes
                </button>
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 px-8 py-3 rounded-xl font-black transition-all uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-sm">
        <h3 className="text-xl font-black text-surface-900 dark:text-white mb-6 flex items-center gap-3 tracking-tighter">
          <ShieldCheck className="text-bkash" />
          Login Credentials
        </h3>
        <form onSubmit={handleUpdateCredentials} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-surface-600 dark:text-surface-400">New Username</label>
              <input 
                type="text" 
                value={credentials.username}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                className="input-field py-3"
                placeholder="Enter new username"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-surface-600 dark:text-surface-400">New Password</label>
              <input 
                type="password" 
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="input-field py-3"
                placeholder="Enter new password"
                required
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isUpdatingCreds}
            className="bg-surface-900 dark:bg-white text-white dark:text-surface-900 px-8 py-3 rounded-xl font-black transition-all flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest text-xs"
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
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-sm">
          <h3 className="font-bold text-xl mb-8 flex items-center gap-2 text-surface-900 dark:text-white">
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
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-800" vertical={false} />
                <XAxis dataKey="date" stroke="currentColor" className="text-surface-400" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="currentColor" className="text-surface-400" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="total" stroke="#E2136E" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-sm">
          <h3 className="font-bold text-xl mb-8 flex items-center gap-2 text-surface-900 dark:text-white">
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
                <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-sm">
        <h3 className="font-bold text-xl mb-8 flex items-center gap-2 text-surface-900 dark:text-white">
          <Zap className="text-amber-500" size={20} />
          Hourly Transaction Volume
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.hourlyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-800" vertical={false} />
              <XAxis dataKey="hour" stroke="currentColor" className="text-surface-400" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" className="text-surface-400" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '12px' }} />
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50/50 dark:bg-surface-950/50">
          <h3 className="font-bold text-lg text-surface-900 dark:text-white">Customer Directory</h3>
          <div className="flex gap-2">
            <button className="bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors">Export CSV</button>
            <button className="bg-bkash text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-bkash/90 transition-colors shadow-lg shadow-bkash/20">Add Customer</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-50 dark:bg-surface-950 text-surface-500 text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th className="py-4 px-6">Customer MSISDN</th>
                <th className="py-4 px-6">Total Transactions</th>
                <th className="py-4 px-6">Total Spent</th>
                <th className="py-4 px-6">Last Activity</th>
                <th className="py-4 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {customers.map((c, i) => (
                <tr key={i} className="hover:bg-surface-50 dark:hover:bg-surface-950 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-bkash/10 flex items-center justify-center text-bkash font-bold text-xs">
                        {c.msisdn.slice(-2)}
                      </div>
                      <span className="font-bold text-sm text-surface-900 dark:text-white">{c.msisdn}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-surface-500 text-sm">{c.total_transactions} orders</td>
                  <td className="py-4 px-6 font-black text-surface-900 dark:text-white">{formatCurrency(c.total_spent)}</td>
                  <td className="py-4 px-6 text-surface-400 text-xs">{new Date(c.last_transaction).toLocaleString()}</td>
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-8 shadow-sm">
        <h3 className="text-xl font-bold mb-8 flex items-center gap-3 text-surface-900 dark:text-white">
          <Download className="text-bkash" />
          Generate Account Statement
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-surface-500 uppercase tracking-widest ml-1">From Date</label>
            <input 
              type="date" 
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field py-3" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-surface-500 uppercase tracking-widest ml-1">To Date</label>
            <input 
              type="date" 
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-field py-3" 
            />
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchStatement}
              disabled={loading}
              className="flex-1 btn-secondary py-3"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Fetch Data"}
            </button>
            <button 
              onClick={handleDownload}
              disabled={transactions.length === 0}
              className="flex-1 btn-primary py-3"
            >
              <Download size={18} /> Download PDF
            </button>
          </div>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/50">
            <h4 className="font-bold text-surface-900 dark:text-white">Preview ({transactions.length} Transactions)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-50 dark:bg-surface-950 text-surface-500 text-[10px] uppercase tracking-widest font-bold">
                <tr>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Trx ID</th>
                  <th className="py-4 px-6">Customer</th>
                  <th className="py-4 px-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {transactions.map((t, i) => (
                  <tr key={i} className="hover:bg-surface-50 dark:hover:bg-surface-950 transition-colors">
                    <td className="py-4 px-6 text-sm text-surface-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6 font-mono text-sm text-surface-900 dark:text-white">{t.trx_id}</td>
                    <td className="py-4 px-6 text-sm text-surface-700 dark:text-surface-300">{t.customer_msisdn}</td>
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
          <ShieldCheck className="text-bkash" />
          Security Overview
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-surface-50 dark:bg-surface-950 rounded-xl border border-surface-100 dark:border-surface-800">
            <div>
              <p className="font-bold text-surface-900 dark:text-white">Two-Factor Authentication</p>
              <p className="text-xs text-surface-500">Add an extra layer of security</p>
            </div>
            <div className="w-12 h-6 bg-bkash rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
          <div className="flex justify-between items-center p-4 bg-surface-50 dark:bg-surface-950 rounded-xl border border-surface-100 dark:border-surface-800">
            <div>
              <p className="font-bold text-surface-900 dark:text-white">IP Whitelisting</p>
              <p className="text-xs text-surface-500">Restrict access to specific IPs</p>
            </div>
            <div className="w-12 h-6 bg-surface-200 dark:bg-surface-700 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-surface-900 dark:text-white">
          <Activity className="text-bkash" />
          Recent Logins
        </h3>
        <div className="space-y-4">
          {[
            { device: "Chrome / Windows", ip: "103.120.2.45", time: "Just now" },
            { device: "Safari / iPhone", ip: "192.168.1.1", time: "2 hours ago" },
          ].map((l, i) => (
            <div key={i} className="flex justify-between items-center p-3 border-b border-surface-100 dark:border-surface-800 last:border-0">
              <div>
                <p className="text-sm font-bold text-surface-900 dark:text-white">{l.device}</p>
                <p className="text-[10px] text-surface-500">{l.ip}</p>
              </div>
              <p className="text-[10px] text-surface-500">{l.time}</p>
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
        className="p-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-surface-400 hover:text-bkash transition-colors relative shadow-sm"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-bkash rounded-full border-2 border-white dark:border-surface-900" />
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
              className="absolute right-0 mt-2 w-80 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-2xl z-[80] overflow-hidden"
            >
              <div className="p-4 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50/50 dark:bg-surface-950/50">
                <h4 className="font-bold text-sm text-surface-900 dark:text-white">Notifications</h4>
                <button onClick={() => setNotifications([])} className="text-[10px] text-surface-500 hover:text-bkash font-bold uppercase tracking-wider">Clear all</button>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-surface-400">
                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs">No new notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-4 border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-950 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <h5 className="font-bold text-xs text-surface-900 dark:text-white">{n.title}</h5>
                        <span className="text-[9px] text-surface-500">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-surface-500 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 bg-surface-50 dark:bg-surface-950 border-t border-surface-100 dark:border-surface-800 text-center">
                <button className="text-[10px] font-bold text-bkash hover:underline uppercase tracking-widest">View all activity</button>
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
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-5 md:p-8 shadow-sm">
        <h3 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-3 text-surface-900 dark:text-white">
          <Search className="text-bkash" />
          Search Transaction Details
        </h3>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <input 
            type="text" 
            placeholder="Enter Transaction ID (e.g. TST...)" 
            value={trxID}
            onChange={(e) => setTrxID(e.target.value)}
            className="input-field py-4"
          />
          <button 
            type="submit" 
            disabled={loading || !isOnline}
            className="btn-primary px-8 py-4"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            Search
          </button>
        </form>

        {result && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-10 space-y-8">
            <div className="flex justify-between items-center border-b border-surface-100 dark:border-surface-800 pb-4">
              <h4 className="text-xs text-surface-500 uppercase font-black tracking-widest">Search Result</h4>
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
                <h4 className="text-xs text-surface-500 uppercase font-black tracking-widest border-b border-surface-100 dark:border-surface-800 pb-2">Transaction Information</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Transaction ID</span>
                    <span className="font-bold text-bkash">{result.trxID || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Amount</span>
                    <span className="font-black text-xl text-surface-900 dark:text-white">{result.amount} {result.currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Status</span>
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight",
                      result.transactionStatus === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {result.transactionStatus || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Transaction Type</span>
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{result.transactionType || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs text-surface-500 uppercase font-black tracking-widest border-b border-surface-100 dark:border-surface-800 pb-2">Customer & Time</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Customer MSISDN</span>
                    <span className="text-sm font-bold text-surface-900 dark:text-white">{result.customerMsisdn || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Initiation Time</span>
                    <span className="text-sm text-surface-600 dark:text-surface-400">{result.initiationTime || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Completed Time</span>
                    <span className="text-sm text-surface-600 dark:text-surface-400">{result.completedTime || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-surface-500">Organization Code</span>
                    <span className="text-sm text-surface-600 dark:text-surface-400">{result.organizationShortCode || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-100 dark:border-surface-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-surface-500 uppercase font-black tracking-widest">Transaction Reference</span>
                <span className="text-sm font-medium italic text-surface-700 dark:text-surface-300">"{result.transactionReference || 'No reference'}"</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-100 dark:border-surface-800">
                <div className="space-y-1">
                  <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Status Code</p>
                  <p className="text-xs font-mono text-surface-900 dark:text-white">{result.statusCode}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] text-surface-500 uppercase font-black tracking-widest">Status Message</p>
                  <p className="text-xs text-surface-600 dark:text-surface-400">{result.statusMessage}</p>
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
        <h3 className="text-xl md:text-2xl font-bold text-surface-900 dark:text-white">User Management</h3>
        <button 
          onClick={() => {
            setEditingUser(null);
            setFormData({ username: "", email: "", password: "", role: "user", permissions: [] });
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto bg-bkash text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-bkash-dark transition-colors shadow-lg shadow-bkash/20"
        >
          <UserPlus size={20} /> Add User
        </button>
      </div>

      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-surface-50 dark:bg-surface-950 text-surface-500 text-xs uppercase tracking-wider">
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
                <tr key={user.id} className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-bkash/10 flex items-center justify-center text-bkash font-bold text-sm overflow-hidden">
                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-surface-900 dark:text-white">{user.username}</p>
                        <p className="text-[10px] text-surface-500">{user.email}</p>
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
                        <span key={p} className="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">{p}</span>
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
                      className="p-2 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-surface-400 hover:text-rose-500 transition-colors"
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
              className="relative w-full max-w-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-5 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <h4 className="text-xl font-bold mb-6 text-surface-900 dark:text-white">{editingUser ? "Edit User" : "Add New User"}</h4>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Username</label>
                    <input 
                      type="text" required
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Email Address</label>
                    <input 
                      type="email" required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Password {editingUser && "(Leave blank to keep current)"}</label>
                    <input 
                      type="password" required={!editingUser}
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="input-field py-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Role</label>
                    <select 
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="input-field py-3"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-surface-600 dark:text-surface-400">Permissions</label>
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
                            : "bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-500 hover:border-bkash/30"
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
                    className="order-2 sm:order-1 flex-1 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 py-3 rounded-xl font-bold transition-all text-surface-600 dark:text-surface-300"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="order-1 sm:order-2 flex-1 bg-bkash hover:bg-bkash-dark py-3 rounded-xl font-bold transition-all text-white"
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
  
  const hasPermission = (perm: string) => {
    // Super Admin has all permissions
    if (userRole === 'admin') return true;
    
    // Merchant restrictions
    if (userRole === 'merchant') {
      const kycStatus = user.merchant?.kyc_status || 'PENDING';
      
      // Before KYC verification, only allow dashboard, profile, and kyc
      if (kycStatus !== 'VERIFIED') {
        return ['dashboard', 'profile', 'kyc'].includes(perm);
      }
      return permissions.includes(perm);
    }
    
    return false;
  };

  useEffect(() => {
    const syncProfile = async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (localStorage.getItem("isAdmin") === "true" && user.id) {
        try {
          const res = await fetch(`/api/user/profile?userId=${user.id}`);
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
    return <div className="min-h-screen bg-surface-50 dark:bg-black text-surface-900 dark:text-surface-50 font-sans selection:bg-bkash/30">{children}</div>;
  }

  if (pathname.startsWith("/admin") && !isAdmin) {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-black text-surface-900 dark:text-surface-50 font-sans selection:bg-bkash/30">
      <SyncManager />
      <div className="lg:hidden fixed top-0 left-0 right-0 h-20 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-900 flex items-center justify-between px-8 z-[60]">
        <BkashLogo />
        <button 
          onClick={toggleMobileMenu}
          className="p-3 text-surface-400 hover:text-bkash transition-colors"
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-surface-950 border-r border-surface-200 dark:border-surface-900 p-8 flex flex-col gap-10 z-50 transition-transform duration-500 ease-in-out lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <BkashLogo className="hidden lg:flex" />

        <div className="lg:hidden h-12" />

        <nav className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-surface-400 px-4 mb-4">Main Menu</div>
          {hasPermission('dashboard') && <SidebarItem icon={LayoutDashboard} label="Dashboard" active={pathname === '/admin'} onClick={() => handleNavClick('/admin')} />}
          {hasPermission('kyc') && <SidebarItem icon={ShieldCheck} label="KYC Verification" active={pathname === '/admin/kyc'} onClick={() => handleNavClick('/admin/kyc')} />}
          {hasPermission('merchants') && <SidebarItem icon={Users} label="Merchants" active={pathname === '/admin/merchants'} onClick={() => handleNavClick('/admin/merchants')} />}
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
          {hasPermission('withdrawals') && (
            <SidebarItem 
              icon={Wallet} 
              label={userRole === 'admin' ? "Withdrawal Requests" : "Withdrawals"} 
              active={pathname === '/admin/withdrawals'} 
              onClick={() => handleNavClick('/admin/withdrawals')} 
            />
          )}
          {hasPermission('subscriptions') && (
            <SidebarItem 
              icon={Zap} 
              label={userRole === 'admin' ? "Subscription Plans" : "Subscriptions"} 
              active={pathname === '/admin/subscriptions'} 
              onClick={() => handleNavClick('/admin/subscriptions')} 
            />
          )}
          <SidebarItem icon={Share2} label="Payment Links" active={pathname === '/generate'} onClick={() => handleNavClick('/generate')} />
        </nav>
        <div className="pt-6 border-t border-surface-200 dark:border-surface-900 flex flex-col gap-1.5">
          <SidebarItem icon={Settings} label="Settings" active={pathname === '/admin/settings'} onClick={() => handleNavClick('/admin/settings')} />
          <SidebarItem icon={LogOut} label="Logout" onClick={handleLogout} />
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      <main className="lg:ml-72 p-4 md:p-10 pt-24 lg:pt-10 min-h-screen flex flex-col">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div className="w-full lg:w-auto">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter truncate flex items-center gap-3">
              {pathname === '/admin' && "System Overview"}
              {pathname === '/admin/kyc' && "KYC Verification"}
              {pathname === '/admin/merchants' && "Merchant Management"}
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
              {pathname === '/admin/withdrawals' && (userRole === 'admin' ? "Withdrawal Requests" : "Withdrawal Management")}
              {pathname === '/admin/subscriptions' && (userRole === 'admin' ? "Subscription Plans" : "Subscription Management")}
              {userRole === 'merchant' && (
                <span className="text-[10px] bg-bkash/10 text-bkash px-2.5 py-1 rounded-full font-black uppercase tracking-widest border border-bkash/20">Merchant</span>
              )}
            </h2>
            <p className="text-surface-500 text-sm md:text-base mt-1 font-medium">
              Welcome back, <span className="text-surface-900 dark:text-white font-bold">{localStorage.getItem("userName") || "Administrator"}</span>
              {userRole === 'merchant' && user.merchant && (
                <span className="ml-2 text-surface-400">({user.merchant.name})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-bkash transition-colors" size={18} />
              <input type="text" placeholder="Search anything..." className="w-full lg:w-72 bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 focus:border-bkash transition-all" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <NotificationBar />
              <Link to="/admin/profile" className="h-11 w-11 md:h-12 md:w-12 rounded-2xl bg-surface-100 dark:bg-surface-900 overflow-hidden border border-surface-200 dark:border-surface-800 shrink-0 hover:border-bkash transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm">
                <img src={localStorage.getItem("userAvatar") || "https://picsum.photos/seed/admin/100/100"} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </Link>
            </div>
          </div>
        </header>
        <div className="flex-1">
          {userRole === 'merchant' && user.merchant?.kyc_status !== 'VERIFIED' && pathname !== '/admin/kyc' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-amber-500/5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="text-amber-500" size={24} />
                </div>
                <div>
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400">KYC Verification Required</p>
                  <p className="text-sm text-amber-600/70 dark:text-amber-400/60 font-medium">Please complete your KYC verification to unlock all features.</p>
                </div>
              </div>
              <Link to="/admin/kyc" className="w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-black text-sm font-black px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-amber-500/20 active:scale-95">
                Verify Now
              </Link>
            </motion.div>
          )}
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

const WithdrawalsRoute = () => {
  const userRole = localStorage.getItem("userRole");
  return userRole === 'admin' ? <AdminWithdrawals /> : <Withdrawals />;
};

const SubscriptionsRoute = () => {
  const userRole = localStorage.getItem("userRole");
  return userRole === 'admin' ? <AdminPlans /> : <Subscriptions />;
};

export default function App() {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const checkInstallation = async () => {
      try {
        const response = await fetch("/api/install/status");
        const data = await response.json();
        setIsInstalled(data.installed);
      } catch (error) {
        console.error("Failed to check installation status", error);
        setIsInstalled(true);
      }
    };
    checkInstallation();
  }, []);

  if (isInstalled === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950">
        <Loader2 className="animate-spin text-bkash" size={48} />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors theme="dark" />
        <Routes>
          <Route path="/install" element={<Installer />} />
          <Route path="/*" element={
            isInstalled === false ? (
              <Navigate to="/install" />
            ) : (
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
                  <Route path="/admin/merchants" element={<MerchantManagement />} />
                  <Route path="/admin/kyc" element={<KYCVerification />} />
                  <Route path="/admin/api-docs" element={<ApiDocs />} />
                  <Route path="/admin/withdrawals" element={<WithdrawalsRoute />} />
                  <Route path="/admin/subscriptions" element={<SubscriptionsRoute />} />
                  <Route path="/generate" element={<PaymentLinkGenerator />} />
                  <Route path="/payment-success" element={<SuccessPage />} />
                  <Route path="/payment-failed" element={<FailurePage />} />
                </Routes>
              </Layout>
            )
          } />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
