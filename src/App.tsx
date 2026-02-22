import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  CreditCard, 
  History, 
  Settings, 
  TrendingUp, 
  Users, 
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
  Info
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
  response_data: string;
  created_at: string;
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-emerald-500/10 text-emerald-500" 
        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
    )}
  >
    <Icon size={20} className={cn("transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
    <span className="font-medium">{label}</span>
    {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
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
        <span className={cn("text-xs font-medium px-2 py-1 rounded-full", trend > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
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
        tx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : 
        tx.status === 'initiated' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
      )}>
        {tx.status === 'completed' ? <CheckCircle2 size={12} /> : tx.status === 'initiated' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
        {tx.status}
      </span>
    </td>
    <td className="py-4 px-4 text-right">
      <span className="text-zinc-500 text-xs">{new Date(tx.created_at).toLocaleString()}</span>
    </td>
  </tr>
);

// --- Pages ---

const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(res => res.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Volume" value={formatCurrency(stats?.totalVolume || 0)} icon={TrendingUp} trend={12.5} color="bg-emerald-500" />
        <StatCard title="Success Payments" value={stats?.successCount || 0} icon={CheckCircle2} trend={8.2} color="bg-blue-500" />
        <StatCard title="Active Agreements" value="1,284" icon={Users} trend={-2.4} color="bg-purple-500" />
        <StatCard title="Avg. Ticket Size" value={formatCurrency(stats?.successCount ? (stats.totalVolume / stats.successCount) : 0)} icon={ArrowUpRight} color="bg-amber-500" />
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
          <Link to="/transactions" className="text-emerald-500 text-sm font-medium hover:underline flex items-center gap-1">View all <ChevronRight size={16} /></Link>
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

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/bkash/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, invoice: `INV-${Date.now()}` }),
      });
      const data = await res.json();
      if (data.bkashURL) {
        console.log("Redirecting to bKash:", data.bkashURL);
        // Try to redirect the current window
        window.location.href = data.bkashURL;
        
        // If it doesn't redirect within 2 seconds (e.g. blocked by iframe), 
        // show a manual link or try opening in new tab
        setTimeout(() => {
          if (confirm("Redirect blocked by browser. Open bKash in a new tab?")) {
            window.open(data.bkashURL, '_blank');
          }
        }, 2000);
      } else {
        alert(data.error || "Payment initiation failed");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="bg-emerald-500 p-8 text-white">
          <h3 className="text-2xl font-bold">Secure Checkout</h3>
          <p className="opacity-80 mt-1">Enterprise Payment Gateway</p>
        </div>
        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-zinc-400">Payment Amount (BDT)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-zinc-500">৳</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-2xl py-4 pl-10 pr-4 text-3xl font-bold focus:border-emerald-500 focus:outline-none transition-all" />
            </div>
          </div>
          <button onClick={handleCheckout} disabled={isProcessing} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 text-lg">
            {isProcessing ? <Loader2 className="animate-spin" /> : <>Pay with bKash <ExternalLink size={20} /></>}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const trxID = searchParams.get("trxID");

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto text-center space-y-8 pt-12">
      <div className="relative inline-block">
        <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse" />
        <div className="relative bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-full">
          <CheckCircle2 size={80} className="text-emerald-500" />
        </div>
      </div>
      <div>
        <h2 className="text-4xl font-black mb-2">Payment Successful!</h2>
        <p className="text-zinc-400">Your transaction has been processed successfully.</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-sm">Transaction ID</span>
          <span className="font-mono font-bold text-emerald-500">{trxID}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 text-sm">Status</span>
          <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md text-xs font-bold uppercase">Completed</span>
        </div>
      </div>
      <div className="flex gap-4">
        <Link to="/" className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
        <button className="flex-1 bg-emerald-500 hover:bg-emerald-400 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
          <Download size={18} /> Receipt
        </button>
      </div>
    </motion.div>
  );
};

const FailurePage = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error") || searchParams.get("status");

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto text-center space-y-8 pt-12">
      <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-full inline-block">
        <XCircle size={80} className="text-rose-500" />
      </div>
      <div>
        <h2 className="text-4xl font-black mb-2">Payment Failed</h2>
        <p className="text-zinc-400">We couldn't process your payment at this time.</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-4 text-left">
        <AlertCircle className="text-rose-500 shrink-0" />
        <div>
          <p className="text-xs text-zinc-500 uppercase font-bold">Error Details</p>
          <p className="text-zinc-300">{error || "Unknown error occurred"}</p>
        </div>
      </div>
      <div className="flex gap-4">
        <Link to="/checkout" className="flex-1 bg-rose-500 hover:bg-rose-400 py-4 rounded-xl font-bold transition-colors">
          Try Again
        </Link>
        <Link to="/" className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-xl font-bold transition-colors">
          Cancel
        </Link>
      </div>
    </motion.div>
  );
};

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
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
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/admin/transactions?${params.toString()}`);
    const data = await res.json();
    setTransactions(data);
    setLoading(false);
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
          <Search size={20} className="text-emerald-500" />
          Filter Payments
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">Start Date</label>
            <input 
              type="date" 
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">End Date</label>
            <input 
              type="date" 
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">Search</label>
            <input 
              type="text" 
              placeholder="TrxID, Invoice, Customer"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchTransactions}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 rounded-xl transition-all"
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
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-500 rounded-xl transition-all"
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
            <p className="text-xl font-black text-emerald-500">{formatCurrency(totalAmount)}</p>
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
                  <td className="py-4 px-6 font-bold text-sm text-emerald-500">{formatCurrency(tx.amount)}</td>
                  <td className="py-4 px-6 text-sm text-zinc-300">{tx.customer_msisdn || "N/A"}</td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      tx.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-500/10 text-zinc-500"
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
                      <Link 
                        to={`/refunds?trx_id=${tx.trx_id}`}
                        className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                        title="Refund"
                      >
                        <RotateCcw size={18} />
                      </Link>
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
                    <p className="font-bold text-emerald-500">{selectedTx.trx_id || "N/A"}</p>
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
                    <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md text-[10px] font-bold uppercase">{selectedTx.status}</span>
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

const SettingsPage = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert("Settings updated successfully");
      }
    } catch (err) {
      alert("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="bg-zinc-800/50 p-8 border-b border-zinc-800">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="text-emerald-500" />
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">App Secret</label>
                  <input 
                    type="password" 
                    value={settings.BKASH_APP_SECRET}
                    onChange={(e) => setSettings({...settings, BKASH_APP_SECRET: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Username</label>
                  <input 
                    type="text" 
                    value={settings.BKASH_USERNAME}
                    onChange={(e) => setSettings({...settings, BKASH_USERNAME: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Password</label>
                  <input 
                    type="password" 
                    value={settings.BKASH_PASSWORD}
                    onChange={(e) => setSettings({...settings, BKASH_PASSWORD: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Application URL</label>
                  <input 
                    type="text" 
                    value={settings.APP_URL}
                    onChange={(e) => setSettings({...settings, APP_URL: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                  <p className="text-xs text-emerald-500/80 leading-relaxed">
                    <ShieldCheck className="inline-block mr-1 mb-0.5" size={14} />
                    <strong>Security Note:</strong> These credentials are encrypted at rest and only used for server-side bKash API calls. Never share your App Secret or Password.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-zinc-800 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 text-white font-bold px-10 py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2"
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

  const [refundForm, setRefundForm] = useState({
    amount: "",
    reason: "Customer requested refund",
    sku: `REFUND-${new Date().toISOString().split('T')[0]}`
  });

  useEffect(() => {
    fetchRefunds();
  }, []);

  const fetchRefunds = async () => {
    const res = await fetch("/api/admin/refunds");
    const data = await res.json();
    setRefunds(data);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTrxId) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/transaction-search?trx_id=${searchTrxId}`);
      const data = await res.json();
      setFoundTx(data);
      if (data) {
        setRefundForm(prev => ({ ...prev, amount: data.amount.toString() }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundTx) return;
    if (!confirm("Are you sure you want to process this refund?")) return;

    setIsProcessing(true);
    try {
      const res = await fetch("/api/bkash/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentID: foundTx.payment_id,
          trxID: foundTx.trx_id,
          amount: refundForm.amount,
          sku: refundForm.sku,
          reason: refundForm.reason
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchRefunds();
        setFoundTx(null);
        setSearchTrxId("");
      } else {
        alert(data.error || "Refund failed");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Search & Process */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Search size={20} className="text-emerald-500" />
              Search Transaction
            </h3>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter Transaction ID (e.g. TST...)" 
                value={searchTrxId}
                onChange={(e) => setSearchTrxId(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button 
                type="submit" 
                disabled={isSearching}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 text-white font-bold px-6 rounded-xl transition-all"
              >
                {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Search"}
              </button>
            </form>

            {foundTx && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Transaction ID</span>
                  <span className="font-bold">{foundTx.trx_id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Amount</span>
                  <span className="font-bold text-emerald-500">{formatCurrency(foundTx.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Customer</span>
                  <span className="font-bold">{foundTx.customer_msisdn || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Date</span>
                  <span className="font-bold">{new Date(foundTx.created_at).toLocaleString()}</span>
                </div>
              </motion.div>
            )}
          </div>

          {foundTx && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <RotateCcw size={20} className="text-rose-500" />
                Process Refund
              </h3>
              <form onSubmit={handleRefund} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Refund Amount (BDT)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">SKU (Optional)</label>
                  <input 
                    type="text" 
                    value={refundForm.sku}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Reason</label>
                  <textarea 
                    rows={3}
                    value={refundForm.reason}
                    onChange={(e) => setRefundForm(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="w-full bg-rose-500 hover:bg-rose-400 disabled:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : "Initiate Refund"}
                </button>
              </form>
            </motion.div>
          )}
        </div>

        {/* Recent Refunds */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-zinc-800">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <History size={20} className="text-emerald-500" />
              Recent Refunds
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Refund ID</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((ref) => (
                  <tr key={ref.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium text-sm">{ref.refund_id}</span>
                        <span className="text-zinc-500 text-xs font-mono">{ref.original_trx_id}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm font-bold text-rose-500">
                      {formatCurrency(ref.refund_amount)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        ref.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {ref.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button 
                        onClick={() => setSelectedRefund(ref)}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Info size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {refunds.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-zinc-500">No refunds found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Refund Detail Modal */}
      <AnimatePresence>
        {selectedRefund && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRefund(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-xl">Refund Details</h3>
                <button onClick={() => setSelectedRefund(null)} className="p-2 text-zinc-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Refund ID</p>
                    <p className="font-mono text-sm">{selectedRefund.refund_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Status</p>
                    <span className={cn(
                      "inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                      selectedRefund.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {selectedRefund.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Original TrxID</p>
                    <p className="font-mono text-sm">{selectedRefund.original_trx_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Refund Amount</p>
                    <p className="font-bold text-rose-500">{formatCurrency(selectedRefund.refund_amount)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase font-bold">Reason</p>
                  <p className="text-sm text-zinc-300">{selectedRefund.reason}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase font-bold">Raw Response</p>
                  <pre className="bg-black/50 p-3 rounded-xl text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedRefund.response_data), null, 2)}
                  </pre>
                </div>
              </div>
              <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setSelectedRefund(null)}
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
                >
                  Close
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

const Layout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const pathname = window.location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleNavClick = (path: string) => {
    navigate(path);
    closeMobileMenu();
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 z-[60]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
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

      {/* Sidebar / Drawer */}
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col gap-8 z-50 transition-transform duration-300 lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden lg:flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CreditCard className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">bKash Pay</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Enterprise</p>
          </div>
        </div>

        <div className="lg:hidden h-10" /> {/* Spacer for mobile header */}

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={pathname === '/'} onClick={() => handleNavClick('/')} />
          <SidebarItem icon={CreditCard} label="Checkout Demo" active={pathname === '/checkout'} onClick={() => handleNavClick('/checkout')} />
          <SidebarItem icon={History} label="Payments" active={pathname === '/transactions'} onClick={() => handleNavClick('/transactions')} />
          <SidebarItem icon={RotateCcw} label="Refunds" active={pathname === '/refunds'} onClick={() => handleNavClick('/refunds')} />
          <SidebarItem icon={TrendingUp} label="Analytics" />
          <SidebarItem icon={Users} label="Customers" />
          <SidebarItem icon={ShieldCheck} label="Security" />
        </nav>
        <div className="pt-6 border-t border-zinc-800 flex flex-col gap-2">
          <SidebarItem icon={Settings} label="Settings" active={pathname === '/settings'} onClick={() => handleNavClick('/settings')} />
          <SidebarItem icon={LogOut} label="Logout" />
        </div>
      </aside>

      {/* Overlay for mobile */}
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
              {pathname === '/' && "System Overview"}
              {pathname === '/checkout' && "Payment Gateway Demo"}
              {pathname === '/refunds' && "Refund Management"}
              {pathname === '/transactions' && "Payment History"}
              {pathname === '/settings' && "System Settings"}
              {pathname === '/payment-success' && "Payment Success"}
              {pathname === '/payment-failed' && "Payment Failed"}
            </h2>
            <p className="text-zinc-500 mt-1">Welcome back, Administrator</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input type="text" placeholder="Search..." className="w-full md:w-64 bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
            </div>
            <button className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"><Bell size={20} /></button>
            <div className="h-10 w-10 rounded-xl bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0">
              <img src="https://picsum.photos/seed/admin/100/100" alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>
        {children}
      </main>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/payment-success" element={<SuccessPage />} />
          <Route path="/payment-failed" element={<FailurePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
