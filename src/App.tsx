import React, { useState, useEffect } from "react";
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
  Menu,
  X,
  RotateCcw,
  Info,
  Terminal,
  Activity,
  Zap
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
  Cell
} from "recharts";
import { cn, formatCurrency } from "./lib/utils";
import { Toaster, toast } from "sonner";
import { saveTransactions, getLocalTransactions, queueAction, getSyncQueue, removeSyncAction } from "./db";

// --- Types ---
interface Transaction {
  id: string;
  payment_id: string;
  trx_id: string;
  amount: number;
  status: string;
  customer_msisdn: string;
  merchant_invoice: string;
  created_at: string;
}

interface Stats {
  totalVolume: number;
  successCount: number;
  recentTransactions: Transaction[];
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
        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
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
    className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl backdrop-blur-sm"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={24} className="text-white" />
      </div>
      {trend && (
        <span className={cn("text-xs font-medium px-2 py-1 rounded-full", trend > 0 ? "bg-bkash/10 text-bkash" : "bg-rose-500/10 text-rose-500")}>
          {trend > 0 ? "+" : ""}{trend}%
        </span>
      )}
    </div>
    <h3 className="text-zinc-400 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold text-white">{value}</p>
  </motion.div>
);

const TransactionRow = ({ tx }: { tx: Transaction, key?: string }) => (
  <tr className="group border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
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
        {tx.status === 'completed' && (
          <Link 
            to={`/admin/refunds?trx_id=${tx.trx_id}`}
            className="p-1.5 text-zinc-500 hover:text-bkash transition-colors"
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
    fetch("/api/admin/stats")
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Volume" value={formatCurrency(stats?.totalVolume || 0)} icon={TrendingUp} trend={12.5} color="bg-bkash" />
        <StatCard title="Success Payments" value={stats?.successCount || 0} icon={CheckCircle2} trend={8.2} color="bg-rose-600" />
        <StatCard title="Active Agreements" value="1,284" icon={Users} trend={-2.4} color="bg-pink-600" />
        <StatCard title="Avg. Ticket Size" value={formatCurrency(stats?.successCount ? (stats.totalVolume / stats.successCount) : 0)} icon={ArrowUpRight} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
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
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="font-bold text-lg mb-6">Payment Methods</h3>
          <div className="h-[250px] w-full">
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
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-lg">Recent Transactions</h3>
          <Link to="/admin/transactions" className="text-bkash text-sm font-medium hover:underline flex items-center gap-1">View all <ChevronRight size={16} /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
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
  const [amount, setAmount] = useState("100");
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
        body: JSON.stringify({ amount, invoice: `INV-${Date.now()}` }),
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="bg-bkash p-8 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s" alt="bKash" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Secure Checkout</h3>
                <p className="opacity-80 mt-1">Enterprise Payment Gateway</p>
              </div>
            </div>
            <Link 
              to="/admin/login" 
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
            >
              <ShieldCheck size={18} /> Admin Panel
            </Link>
          </div>
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-zinc-400">Payment Amount (BDT)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-zinc-500">৳</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-2xl py-4 pl-10 pr-4 text-3xl font-bold text-white focus:border-bkash focus:outline-none transition-all" />
              </div>
            </div>
            <button 
              onClick={handleCheckout} 
              disabled={isProcessing || !isOnline} 
              className={cn(
                "w-full font-bold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-lg",
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl shadow-bkash/10">
        <div className="bg-bkash p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
            className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"
          >
            <CheckCircle2 size={48} className="text-bkash" />
          </motion.div>
          <h2 className="relative z-10 text-2xl font-black text-white">Payment Successful</h2>
        </div>
        
        <div className="p-8 md:p-12 space-y-8">
          <div className="text-center">
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mb-2">Amount Paid</p>
            <h3 className="text-5xl font-black text-white">
              <span className="text-bkash mr-2">৳</span>
              {parseFloat(amount || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-500 font-medium">Transaction ID</span>
              <span className="font-mono font-bold text-zinc-200">{trxID}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-500 font-medium">Date & Time</span>
              <span className="font-bold text-zinc-200">{formattedTime}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-500 font-medium">Customer</span>
              <span className="font-bold text-zinc-200">
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
              to="/checkout" 
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ArrowLeft size={18} /> Pay Again
            </Link>
            <button className="flex-1 bg-bkash hover:bg-bkash/90 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 text-white shadow-lg shadow-bkash/20">
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
      <div className="flex gap-4">
        <Link to="/checkout" className="flex-1 bg-bkash hover:bg-bkash/90 py-4 rounded-xl font-bold transition-colors">
          Try Again
        </Link>
        <Link to="/" className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-xl font-bold transition-colors">
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
        const params = new URLSearchParams(filters);
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
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <Search size={20} className="text-bkash" />
          Filter Payments
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
              className="flex-1 bg-bkash hover:bg-bkash/90 text-white font-bold py-2 rounded-xl transition-all"
            >
              Filter
            </button>
            <button 
              onClick={() => {
                setFilters({ start_date: "", end_date: "", search: "" });
                // Need to fetch again after reset
                setTimeout(fetchTransactions, 0);
              }}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-xl transition-all"
            >
              Reset
            </button>
            <button 
              onClick={handleExport}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-bkash rounded-xl transition-all"
              title="Export CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-lg">Transaction List</h3>
          <div className="text-right">
            <p className="text-xs text-zinc-500 uppercase font-bold">Total Volume</p>
            <p className="text-xl font-black text-bkash">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6 font-semibold">Date / Time</th>
                <th className="py-4 px-6 font-semibold">Transaction ID</th>
                <th className="py-4 px-6 font-semibold">Amount</th>
                <th className="py-4 px-6 font-semibold">Customer</th>
                <th className="py-4 px-6 font-semibold">Status</th>
                <th className="py-4 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Loading...</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="group border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
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
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const isOnline = useOnlineStatus();

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
    fetch("/api/admin/settings")
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (!isOnline) {
        await queueAction({ type: 'settings', payload: settings });
        toast.info("You are offline. Settings update queued for sync.");
        return;
      }
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success("Settings updated successfully");
      }
    } catch (err) {
      toast.error("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-bkash" size={40} /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="bg-zinc-800/50 p-8 border-b border-zinc-800">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="text-bkash" />
            System Configuration
          </h3>
          <p className="text-zinc-500 mt-1 font-medium">Manage your bKash API credentials and application settings.</p>
        </div>
        
        <form onSubmit={handleSave} className="p-8 space-y-8">
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
                <div className="p-4 bg-bkash/5 border border-bkash/10 rounded-2xl">
                  <p className="text-xs text-bkash/80 leading-relaxed">
                    <ShieldCheck className="inline-block mr-1 mb-0.5" size={14} />
                    <strong>Security Note:</strong> These credentials are encrypted at rest and only used for server-side bKash API calls. Never share your App Secret or Password.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={testConnection}
                  disabled={isTesting || !isOnline}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {isTesting ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} className="text-amber-500" />}
                  Test bKash Connection
                </button>
              </div>
            </div>
          </div>

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
      if (!res.ok) throw new Error("Failed to fetch refunds");
      const data = await res.json();
      setRefunds(data);
    } catch (err) {
      console.error("Fetch Refunds Error:", err);
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
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Search size={20} className="text-bkash" />
              Search Transaction
            </h3>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter Transaction ID (e.g. TST...)" 
                value={searchTrxId}
                onChange={(e) => setSearchTrxId(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-bkash/50"
              />
              <button 
                type="submit" 
                disabled={isSearching}
                className="bg-bkash hover:bg-bkash/90 disabled:bg-zinc-700 text-white font-bold px-6 rounded-xl transition-all"
              >
                {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Search"}
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
                </div>
              </motion.div>
            )}
          </div>

          {/* Process Refund Form Card */}
          <div className={cn(
            "bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm transition-opacity duration-300",
            !foundTx && "opacity-50 pointer-events-none"
          )}>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <RotateCcw size={20} className="text-rose-500" />
              Process Refund
            </h3>
            <form onSubmit={handleRefund} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase font-bold">Refund Amount <span className="text-rose-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase font-bold">SKU (Optional)</label>
                  <input 
                    type="text" 
                    value={refundForm.sku}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 uppercase font-bold">Reason (Optional)</label>
                <textarea 
                  rows={3}
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none"
                  placeholder="e.g. Customer requested refund"
                />
              </div>
              <button 
                type="submit" 
                disabled={isProcessing || !foundTx}
                className="w-full bg-bkash hover:bg-bkash/90 disabled:bg-zinc-700 text-white font-black py-4 rounded-xl shadow-xl shadow-bkash/20 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : "Initiate Refund Request"}
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
            <table className="w-full text-left">
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

const AdminLogin = () => {
  const [username, setUsername] = useState(localStorage.getItem("rememberedUsername") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("rememberedUsername"));
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        localStorage.setItem("isAdmin", "true");
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
      toast.error("Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-bkash/20 p-4">
            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s" alt="bKash" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-white">Admin Login</h2>
          <p className="text-zinc-500 text-sm mt-1">Access secure dashboard</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
              placeholder="admin"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-bkash focus:ring-bkash"
            />
            <label htmlFor="remember" className="text-sm text-zinc-400 cursor-pointer">Remember me</label>
          </div>

          <button 
            type="submit"
            className="w-full bg-bkash hover:bg-bkash/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-bkash/20 transition-all"
          >
            Sign In
          </button>
          <Link to="/" className="block text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Back to Checkout
          </Link>
        </form>
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
              {isEditing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl p-4">
                  <p className="text-[10px] font-bold text-center">Use URL below to change</p>
                </div>
              )}
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

const Layout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem("isAdmin") === "true");
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const checkAuth = () => {
      setIsAdmin(localStorage.getItem("isAdmin") === "true");
    };
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleNavClick = (path: string) => {
    navigate(path);
    closeMobileMenu();
  };

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
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
    <div className="min-h-screen bg-black text-white font-sans selection:bg-bkash/30">
      <SyncManager />
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 z-[60]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-bkash rounded-lg flex items-center justify-center">
            <CreditCard className="text-white" size={18} />
          </div>
          <h1 className="font-bold text-base">bKash Pay</h1>
        </div>
        <button 
          onClick={toggleMobileMenu}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col gap-8 z-50 transition-transform duration-300 lg:translate-x-0",
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

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={pathname === '/admin'} onClick={() => handleNavClick('/admin')} />
          <SidebarItem icon={History} label="Payments" active={pathname === '/admin/transactions'} onClick={() => handleNavClick('/admin/transactions')} />
          <SidebarItem icon={RotateCcw} label="Refunds" active={pathname === '/admin/refunds'} onClick={() => handleNavClick('/admin/refunds')} />
          <SidebarItem icon={Terminal} label="System Logs" active={pathname === '/admin/logs'} onClick={() => handleNavClick('/admin/logs')} />
          <SidebarItem icon={Activity} label="Audit Trail" active={pathname === '/admin/audit-logs'} onClick={() => handleNavClick('/admin/audit-logs')} />
          <SidebarItem icon={User} label="My Profile" active={pathname === '/admin/profile'} onClick={() => handleNavClick('/admin/profile')} />
          <SidebarItem icon={TrendingUp} label="Analytics" />
          <SidebarItem icon={Users} label="Customers" />
          <SidebarItem icon={ShieldCheck} label="Security" />
        </nav>
        <div className="pt-6 border-t border-zinc-800 flex flex-col gap-2">
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

      <main className="lg:ml-64 p-4 md:p-8 pt-20 lg:pt-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {pathname === '/admin' && "System Overview"}
              {pathname === '/admin/refunds' && "Refund Management"}
              {pathname === '/admin/transactions' && "Payment History"}
              {pathname === '/admin/settings' && "System Settings"}
              {pathname === '/admin/profile' && "My Profile"}
              {pathname === '/admin/logs' && "System Logs"}
              {pathname === '/admin/audit-logs' && "Audit Trail"}
            </h2>
            <p className="text-zinc-500 mt-1">Welcome back, {localStorage.getItem("userName") || "Administrator"}</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input type="text" placeholder="Search..." className="w-full md:w-64 bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/50 transition-all" />
            </div>
            <button className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"><Bell size={20} /></button>
            <Link to="/admin/profile" className="h-10 w-10 rounded-xl bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0 hover:border-bkash transition-colors">
              <img src={localStorage.getItem("userAvatar") || "https://picsum.photos/seed/admin/100/100"} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </Link>
          </div>
        </header>
        {children}
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
    <BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
      <Layout>
        <Routes>
          <Route path="/" element={<Checkout />} />
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/refunds" element={<Refunds />} />
          <Route path="/admin/transactions" element={<Transactions />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/profile" element={<UserProfile />} />
          <Route path="/admin/logs" element={<LogsPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
          <Route path="/payment-success" element={<SuccessPage />} />
          <Route path="/payment-failed" element={<FailurePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
