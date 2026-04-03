/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, Package, AlertCircle, Calendar, Hash, Info, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Item } from './types';
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState(false);
  
  // Admin Mode States
  const [role, setRole] = useState<'guest' | 'admin'>('guest');
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // We don't throw here to avoid crashing the UI, but we log it.
  };

  // Test connection to Firestore
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  // Listen to Firestore changes
  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Item[];
      setItems(newItems);
      setIsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    return () => unsubscribe();
  }, []);

  // Check for duplicate code in real-time
  useEffect(() => {
    if (code.trim() === '') {
      setIsDuplicate(false);
      return;
    }
    const exists = items.some(item => item.code.toLowerCase() === code.trim().toLowerCase());
    setIsDuplicate(exists);
  }, [code, items]);

  const addItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || isDuplicate) return;

    const newItemData = {
      code: code.trim(),
      name: name.trim(),
      date: date,
      description: description.trim(),
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'items'), newItemData);
      setCode('');
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'items');
    }
  };

  const removeItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'items', id));
      setDeleteItemId(null);
      setDeletePassword('');
      setDeleteError(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `items/${id}`);
    }
  };

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClickTime < 1000) {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount >= 3) {
        if (role === 'admin') {
          setRole('guest');
          setClickCount(0);
        } else {
          setShowLoginModal(true);
          setClickCount(0);
        }
      }
    } else {
      setClickCount(1);
    }
    setLastClickTime(now);
  };

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    if (loginPassword === 'malik') {
      setRole('admin');
      setShowLoginModal(false);
      setLoginPassword('');
      setLoginError(false);
    } else {
      setLoginError(true);
      setLoginPassword('');
    }
  };

  const handleConfirmDelete = (e: FormEvent) => {
    e.preventDefault();
    if (deletePassword === 'malik') {
      if (deleteItemId) {
        removeItem(deleteItemId);
      }
    } else {
      setDeleteError(true);
      setDeletePassword('');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = searchDate === '' || item.date === searchDate;
    
    return matchesSearch && matchesDate;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-6 md:mb-8 text-center relative">
          <motion.div 
            onClick={handleLogoClick}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-emerald-600 text-white rounded-2xl mb-4 shadow-lg shadow-emerald-200 cursor-pointer active:scale-95 transition-transform"
          >
            <Package size={32} />
          </motion.div>
          
          {role === 'admin' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1.5"
            >
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              ADMIN MODE
              <button 
                onClick={() => setRole('guest')}
                className="ml-2 hover:text-emerald-900 underline"
              >
                Logout
              </button>
            </motion.div>
          )}

          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800"
          >
            Pendataan
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 mt-1 md:mt-2 text-sm md:text-base"
          >
            {role === 'admin' ? 'Mode Admin: Kontrol Penuh Aktif' : 'Sistem pendataan mandiri yang sederhana'}
          </motion.p>
        </header>

        {/* Input Form - Only visible for Admin */}
        <AnimatePresence>
          {role === 'admin' && (
            <motion.section 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <form onSubmit={addItem} className="space-y-5 md:space-y-6" autoComplete="off">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  {/* Kode */}
                  <div>
                    <label htmlFor="code" className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                      <Hash size={14} />
                      Kode
                    </label>
                    <div className="relative">
                      <input
                        id="code"
                        type="text"
                        autoComplete="off"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Contoh: ID-001"
                        className={`w-full px-4 py-2.5 md:py-2 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-base md:text-sm ${
                          isDuplicate 
                            ? 'border-red-500 bg-red-50 focus:ring-red-500 text-red-900' 
                            : 'border-slate-200 focus:ring-emerald-500 focus:border-transparent'
                        }`}
                        required
                      />
                      {isDuplicate && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-red-500 text-[10px] md:text-xs font-semibold mt-1.5 flex items-center gap-1"
                        >
                          <AlertCircle size={12} />
                          Kode sudah terdaftar!
                        </motion.p>
                      )}
                    </div>
                  </div>

                  {/* Nama User */}
                  <div>
                    <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                      <Package size={14} />
                      Nama User
                    </label>
                    <input
                      id="name"
                      type="text"
                      autoComplete="off"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Masukkan nama user"
                      className="w-full px-4 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-base md:text-sm"
                      required
                    />
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label htmlFor="date" className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                      <Calendar size={14} />
                      Tanggal
                    </label>
                    <input
                      id="date"
                      type="date"
                      autoComplete="off"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-base md:text-sm"
                      required
                    />
                  </div>

                  {/* Keterangan */}
                  <div>
                    <label htmlFor="description" className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                      <Info size={14} />
                      Keterangan
                    </label>
                    <input
                      id="description"
                      type="text"
                      autoComplete="on"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Catatan tambahan..."
                      className="w-full px-4 py-2.5 md:py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-base md:text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isDuplicate}
                  className={`w-full font-semibold py-3.5 md:py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] ${
                    isDuplicate 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
                  }`}
                >
                  <Plus size={20} />
                  Simpan Data
                </button>
              </form>
            </motion.section>
          )}
        </AnimatePresence>

        {/* List Section */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 px-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-700">Daftar Pendataan</h2>
              <p className="text-xs text-slate-500">{items.length} Total Data Terdaftar</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
              {/* Search Text */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Cari kode atau nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 md:py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm text-base md:text-sm"
                />
              </div>

              {/* Search Date */}
              <div className="relative flex-1 sm:max-w-[180px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
                <input
                  type="date"
                  autoComplete="off"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 md:py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm text-base md:text-sm"
                />
                {searchDate && (
                  <button 
                    onClick={() => setSearchDate('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <span className="text-xl font-bold leading-none">×</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Kode</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Nama User</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Keterangan</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredItems.length === 0 ? (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Package className="mb-2 opacity-20" size={48} />
                          <p className="text-sm">
                            {searchQuery || searchDate
                              ? `Tidak ada hasil untuk pencarian Anda` 
                              : 'Belum ada data yang dicatat.'}
                          </p>
                        </div>
                      </td>
                    </motion.tr>
                  ) : (
                    filteredItems.map((item) => (
                      <motion.tr
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                            {item.code}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{item.name}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(item.date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 text-slate-500 italic max-w-[200px] truncate">
                          {item.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {role === 'admin' && (
                            <button
                              onClick={() => setDeleteItemId(item.id)}
                              className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all active:scale-90"
                              title="Hapus"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white p-8 rounded-2xl border border-slate-200 text-center"
                >
                  <Package className="mx-auto text-slate-200 mb-2" size={40} />
                  <p className="text-slate-400 text-sm">
                    {searchQuery || searchDate
                      ? `Tidak ada hasil untuk pencarian Anda` 
                      : 'Belum ada data yang dicatat.'}
                  </p>
                </motion.div>
              ) : (
                filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md text-xs">
                        {item.code}
                      </span>
                      {role === 'admin' && (
                        <button
                          onClick={() => setDeleteItemId(item.id)}
                          className="text-slate-300 hover:text-red-500 p-2 -mr-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-slate-800 text-lg mb-1">{item.name}</h3>
                    
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
                      <Calendar size={14} />
                      {new Date(item.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>

                    {item.description && (
                      <div className="bg-slate-50 p-3 rounded-xl text-slate-600 text-sm italic border border-slate-100 flex items-start gap-2">
                        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        {item.description}
                      </div>
                    )}
                    
                    {/* Accent bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto mb-6">
                  <Package size={32} />
                </div>
                <h2 className="text-xl font-bold text-center text-slate-800 mb-2">Login Admin</h2>
                <p className="text-slate-500 text-center text-sm mb-8">Masukkan password untuk akses penuh</p>
                
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      autoFocus
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password"
                      className={`w-full px-5 py-3 bg-slate-50 border rounded-2xl focus:outline-none focus:ring-2 transition-all text-center text-lg tracking-widest ${
                        loginError ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-emerald-500'
                      }`}
                    />
                    {loginError && (
                      <p className="text-red-500 text-xs font-semibold mt-2 text-center">Password salah!</p>
                    )}
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLoginModal(false);
                        setLoginPassword('');
                        setLoginError(false);
                      }}
                      className="flex-1 py-3 text-slate-500 font-semibold hover:bg-slate-50 rounded-2xl transition-all"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                    >
                      Masuk
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteItemId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 text-red-600 mb-4">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <Trash2 size={24} />
                  </div>
                  <h3 className="text-xl font-bold">Konfirmasi Hapus</h3>
                </div>
                
                <p className="text-slate-600 text-sm mb-6">
                  Data ini akan dihapus secara permanen. Silakan masukkan password untuk melanjutkan.
                </p>

                <form onSubmit={handleConfirmDelete} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      autoFocus
                      placeholder="Masukkan password..."
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError(false);
                      }}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-base ${
                        deleteError 
                          ? 'border-red-500 ring-red-100 ring-2' 
                          : 'border-slate-200 focus:ring-emerald-500 focus:border-transparent'
                      }`}
                    />
                    {deleteError && (
                      <p className="text-red-500 text-xs font-semibold mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Password salah!
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteItemId(null);
                        setDeletePassword('');
                        setDeleteError(false);
                      }}
                      className="flex-1 px-4 py-3 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg shadow-red-100"
                    >
                      Hapus
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
