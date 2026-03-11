import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  Key, 
  User, 
  Globe, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Settings,
  Lock
} from "lucide-react";
import { cn } from "../lib/utils";

const Installer = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    BKASH_APP_KEY: "",
    BKASH_APP_SECRET: "",
    BKASH_USERNAME: "",
    BKASH_PASSWORD: "",
    BKASH_BASE_URL: "https://tokenized.pay.bka.sh/v1.2.0-beta",
    APP_URL: window.location.origin,
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          window.location.href = "/";
        }, 3000);
      } else {
        setError(data.error || "Installation failed");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  if (success) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-surface-900 rounded-[3rem] p-12 shadow-2xl border border-surface-200 dark:border-surface-800 text-center"
        >
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="text-emerald-500" size={48} />
          </div>
          <h2 className="text-3xl font-black tracking-tighter mb-4">Installation Complete!</h2>
          <p className="text-surface-500 font-medium mb-8">Your bKash Payment Gateway is ready. Redirecting you to the login page...</p>
          <div className="w-full h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-bkash"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 3 }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-6 font-sans">
      <div className="max-w-4xl w-full grid md:grid-cols-[350px_1fr] bg-white dark:bg-surface-900 rounded-[3rem] overflow-hidden shadow-2xl border border-surface-200 dark:border-surface-800">
        {/* Sidebar */}
        <div className="bg-bkash p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8">
              <Shield size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter leading-none mb-4">Setup Wizard</h1>
            <p className="text-white/70 font-medium">Configure your bKash Enterprise Payment Gateway in just a few steps.</p>
          </div>

          <div className="space-y-6 relative z-10">
            {[
              { id: 1, label: "Welcome", icon: Globe },
              { id: 2, label: "bKash API", icon: Key },
              { id: 3, label: "Admin Account", icon: User },
              { id: 4, label: "Finalize", icon: CheckCircle2 }
            ].map((s) => (
              <div key={s.id} className={cn(
                "flex items-center gap-4 transition-all duration-300",
                step === s.id ? "opacity-100 translate-x-2" : "opacity-40"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border-2",
                  step === s.id ? "bg-white text-bkash border-white" : "border-white/30"
                )}>
                  <s.icon size={16} />
                </div>
                <span className="font-bold text-sm uppercase tracking-widest">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Decorative Circles */}
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="p-12 md:p-16 flex flex-col">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1"
              >
                <h2 className="text-3xl font-black tracking-tighter mb-6">Welcome to bKash Pay</h2>
                <p className="text-surface-500 mb-8 leading-relaxed">
                  This wizard will help you set up your payment gateway. Before we begin, make sure you have your bKash Merchant API credentials ready.
                </p>
                
                <div className="space-y-4 mb-12">
                  <div className="flex gap-4 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-100 dark:border-surface-800">
                    <div className="w-10 h-10 bg-bkash/10 rounded-xl flex items-center justify-center shrink-0">
                      <Settings className="text-bkash" size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">System Check</h4>
                      <p className="text-xs text-surface-500">Database and file permissions are verified.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-100 dark:border-surface-800">
                    <div className="w-10 h-10 bg-bkash/10 rounded-xl flex items-center justify-center shrink-0">
                      <Lock className="text-bkash" size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Secure Setup</h4>
                      <p className="text-xs text-surface-500">Your credentials will be encrypted and stored securely.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">Application URL</span>
                    <input 
                      type="text" 
                      name="APP_URL"
                      value={formData.APP_URL}
                      onChange={handleChange}
                      className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                      placeholder="https://yourdomain.com"
                    />
                  </label>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1"
              >
                <h2 className="text-3xl font-black tracking-tighter mb-6">bKash API Configuration</h2>
                <div className="grid gap-4 mb-8">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">App Key</span>
                    <input 
                      type="text" 
                      name="BKASH_APP_KEY"
                      value={formData.BKASH_APP_KEY}
                      onChange={handleChange}
                      className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">App Secret</span>
                    <input 
                      type="password" 
                      name="BKASH_APP_SECRET"
                      value={formData.BKASH_APP_SECRET}
                      onChange={handleChange}
                      className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">Username</span>
                      <input 
                        type="text" 
                        name="BKASH_USERNAME"
                        value={formData.BKASH_USERNAME}
                        onChange={handleChange}
                        className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">Password</span>
                      <input 
                        type="password" 
                        name="BKASH_PASSWORD"
                        value={formData.BKASH_PASSWORD}
                        onChange={handleChange}
                        className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">Environment</span>
                    <select 
                      name="BKASH_BASE_URL"
                      value={formData.BKASH_BASE_URL}
                      onChange={handleChange}
                      className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                    >
                      <option value="https://tokenized.pay.bka.sh/v1.2.0-beta">Sandbox (Testing)</option>
                      <option value="https://tokenized.pay.bka.sh/v1.2.0-beta">Live (Production)</option>
                    </select>
                  </label>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1"
              >
                <h2 className="text-3xl font-black tracking-tighter mb-6">Admin Account</h2>
                <p className="text-surface-500 mb-8">Create your super admin account to manage the platform.</p>
                <div className="grid gap-4 mb-8">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">Admin Username</span>
                    <input 
                      type="text" 
                      name="ADMIN_USERNAME"
                      value={formData.ADMIN_USERNAME}
                      onChange={handleChange}
                      className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 ml-4 mb-2 block">Admin Password</span>
                    <input 
                      type="password" 
                      name="ADMIN_PASSWORD"
                      value={formData.ADMIN_PASSWORD}
                      onChange={handleChange}
                      className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-bkash/30 transition-all"
                      placeholder="Choose a strong password"
                    />
                  </label>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1"
              >
                <h2 className="text-3xl font-black tracking-tighter mb-6">Ready to Install</h2>
                <p className="text-surface-500 mb-8">We've collected all the necessary information. Click the button below to finalize the installation.</p>
                
                <div className="bg-surface-50 dark:bg-surface-800/50 p-6 rounded-[2rem] border border-surface-100 dark:border-surface-800 mb-8">
                  <h4 className="font-black text-[10px] uppercase tracking-widest text-surface-400 mb-4">Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500">Admin User</span>
                      <span className="font-bold">{formData.ADMIN_USERNAME}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500">Environment</span>
                      <span className="font-bold">{formData.BKASH_BASE_URL.includes('beta') ? 'Sandbox' : 'Live'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500">App URL</span>
                      <span className="font-bold truncate max-w-[200px]">{formData.APP_URL}</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-3 p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 mb-8">
                    <AlertCircle size={20} />
                    <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-auto pt-8 border-t border-surface-100 dark:border-surface-800">
            {step > 1 ? (
              <button 
                onClick={prevStep}
                className="flex items-center gap-2 text-surface-500 font-bold uppercase tracking-widest text-[10px] hover:text-bkash transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button 
                onClick={nextStep}
                className="btn-primary flex items-center gap-2 px-8 py-4 rounded-2xl"
              >
                Next Step
                <ChevronRight size={18} />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary flex items-center gap-2 px-12 py-4 rounded-2xl disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Install Now"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Installer;
