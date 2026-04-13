/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { 
  Plus, 
  Trash2, 
  Package, 
  AlertCircle, 
  Calendar, 
  Hash, 
  Info, 
  Search, 
  Pencil, 
  X,
  BookOpen,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Item, Module } from './types';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc,
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
  const [activeTab, setActiveTab] = useState<'pendataan' | 'modul'>('pendataan');
  const [items, setItems] = useState<Item[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  
  // Item Form States
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  
  // Module Form States
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleLink, setModuleLink] = useState('');
  const [isAddingModule, setIsAddingModule] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
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
    const initFirebase = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    initFirebase();
  }, []);

  // Listen to Firestore changes
  useEffect(() => {
    const qItems = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Item[];
      setItems(newItems);
      setIsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    const qModules = query(collection(db, 'modules'), orderBy('createdAt', 'desc'));
    const unsubscribeModules = onSnapshot(qModules, (snapshot) => {
      const newModules = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Module[];
      setModules(newModules);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'modules');
    });

    return () => {
      unsubscribeItems();
      unsubscribeModules();
    };
  }, []);

  // Check for duplicate code in real-time
  useEffect(() => {
    if (code.trim() === '') {
      setIsDuplicate(false);
      return;
    }
    // Don't flag as duplicate if it's the item we're currently editing
    const exists = items.some(item => 
      item.code.toLowerCase() === code.trim().toLowerCase() && 
      item.id !== editingId
    );
    setIsDuplicate(exists);
  }, [code, items, editingId]);

  const addItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || isDuplicate) return;

    const itemData = {
      code: code.trim(),
      name: name.trim(),
      date: date,
      description: description.trim(),
      createdAt: editingId ? items.find(i => i.id === editingId)?.createdAt || Date.now() : Date.now(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'items', editingId), itemData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'items'), itemData);
      }
      setCode('');
      setName('');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'items');
    }
  };

  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name);
    setDate(item.date);
    setDescription(item.description);
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
  };

  const addModule = async (e: FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim() || !moduleLink.trim()) return;

    setIsAddingModule(true);
    
    try {
      const moduleData = {
        title: moduleTitle.trim(),
        link: moduleLink.trim(),
        createdAt: editingModuleId ? modules.find(m => m.id === editingModuleId)?.createdAt || Date.now() : Date.now(),
      };

      if (editingModuleId) {
        await updateDoc(doc(db, 'modules', editingModuleId), moduleData);
        setEditingModuleId(null);
      } else {
        await addDoc(collection(db, 'modules'), moduleData);
      }
      setModuleTitle('');
      setModuleLink('');
    } catch (error) {
      handleFirestoreError(error, editingModuleId ? OperationType.UPDATE : OperationType.CREATE, 'modules');
    } finally {
      setIsAddingModule(false);
    }
  };

  const startEditModule = (module: Module) => {
    setEditingModuleId(module.id);
    setModuleTitle(module.title);
    setModuleLink(module.link);
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditModule = () => {
    setEditingModuleId(null);
    setModuleTitle('');
    setModuleLink('');
  };

  const removeModule = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'modules', id));
      setDeleteModuleId(null);
      setDeletePassword('');
      setDeleteError(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `modules/${id}`);
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
      } else if (deleteModuleId) {
        removeModule(deleteModuleId);
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
    <div className="min-h-screen text-slate-600 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center relative">
          <motion.div 
            onClick={handleLogoClick}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center justify-center p-4 bg-white border border-etiqa-yellow/30 text-etiqa-black rounded-2xl mb-6 shadow-sm cursor-pointer active:scale-95 transition-all hover:border-etiqa-yellow hover:shadow-md"
          >
            <Package size={40} />
          </motion.div>
          
          {/* Admin Status */}
          <div className="absolute top-0 right-0">
            {role === 'admin' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card px-4 py-2 rounded-xl text-[10px] font-bold border border-etiqa-yellow/30 flex items-center gap-2 tracking-widest text-etiqa-black"
              >
                <div className="w-2 h-2 bg-etiqa-yellow rounded-full animate-pulse shadow-[0_0_8px_rgba(255,209,0,0.5)]" />
                SYSTEM ADMIN
                <button 
                  onClick={() => setRole('guest')}
                  className="ml-2 text-slate-400 hover:text-etiqa-black transition-colors uppercase"
                >
                  [EXIT]
                </button>
              </motion.div>
            )}
          </div>

          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl md:text-5xl font-bold tracking-tighter text-slate-900 mb-2"
          >
            ETIQA<span className="text-etiqa-yellow">DATABASE</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 font-mono text-xs md:text-sm uppercase tracking-[0.3em]"
          >
            {role === 'admin' ? 'Terminal: Access Granted' : 'Public Access Terminal v2.0'}
          </motion.p>

          {/* Tab Switcher */}
          <div className="flex items-center justify-center mt-10 p-1 bg-slate-100 border border-slate-200 rounded-2xl w-fit mx-auto">
            <button
              onClick={() => setActiveTab('pendataan')}
              className={`px-8 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-widest ${
                activeTab === 'pendataan' 
                  ? 'bg-etiqa-yellow text-etiqa-black shadow-sm border border-etiqa-yellow/20' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Package size={14} />
              Registry
            </button>
            <button
              onClick={() => setActiveTab('modul')}
              className={`px-8 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-widest ${
                activeTab === 'modul' 
                  ? 'bg-etiqa-yellow text-etiqa-black shadow-sm border border-etiqa-yellow/20' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <BookOpen size={14} />
              Assets
            </button>
          </div>
        </header>

        {activeTab === 'pendataan' ? (
          <>
            {/* Input Form - Only visible for Admin */}
        <AnimatePresence>
          {role === 'admin' && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="glass-card p-6 md:p-8 rounded-3xl mb-10 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-etiqa-yellow" />
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-etiqa-yellow/10 text-etiqa-black rounded-lg">
                  <Plus size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {editingId ? 'Update Entry' : 'New Entry'}
                </h2>
              </div>

              <form onSubmit={addItem} className="space-y-6" autoComplete="off">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Kode */}
                  <div>
                    <label htmlFor="code" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      <Hash size={14} className="text-etiqa-yellow" />
                      System Code
                    </label>
                    <div className="relative">
                      <input
                        id="code"
                        type="text"
                        autoComplete="off"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="ID-XXXX"
                        className={`w-full input-field font-mono text-sm ${
                          isDuplicate ? 'border-red-500 focus:ring-red-500/10 text-red-600' : ''
                        }`}
                        required
                      />
                      {isDuplicate && (
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-red-500 text-[10px] font-bold mt-2 flex items-center gap-1 uppercase tracking-tighter"
                        >
                          <AlertCircle size={12} />
                          Duplicate entry detected
                        </motion.p>
                      )}
                    </div>
                  </div>

                  {/* Nama User */}
                  <div>
                    <label htmlFor="name" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      <Package size={14} className="text-etiqa-yellow" />
                      Operator Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      autoComplete="off"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter identity"
                      className="w-full input-field text-sm"
                      required
                    />
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label htmlFor="date" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      <Calendar size={14} className="text-etiqa-yellow" />
                      Timestamp
                    </label>
                    <input
                      id="date"
                      type="date"
                      autoComplete="off"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full input-field text-sm"
                      required
                    />
                  </div>

                  {/* Keterangan */}
                  <div>
                    <label htmlFor="description" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      <Info size={14} className="text-etiqa-yellow" />
                      Metadata
                    </label>
                    <input
                      id="description"
                      type="text"
                      autoComplete="on"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Additional logs..."
                      className="w-full input-field text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 uppercase text-xs tracking-widest"
                    >
                      <X size={18} />
                      Abort
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isDuplicate}
                    className={`font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg uppercase text-xs tracking-widest ${
                      editingId ? 'flex-1' : 'w-full'
                    } ${
                      isDuplicate 
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                        : 'neon-button'
                    }`}
                  >
                    {editingId ? <Pencil size={18} /> : <Plus size={18} />}
                    {editingId ? 'Update Registry' : 'Commit Data'}
                  </button>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>

        {/* List Section */}
        <section className="glass-card rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                <div className="w-1.5 h-6 bg-etiqa-yellow rounded-full" />
                Registry Explorer
              </h2>
              <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{items.length} Active Records Found</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-2xl">
              {/* Search Text */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-etiqa-black/30">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="SEARCH BY ID OR NAME..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-etiqa-yellow/50 focus:ring-4 focus:ring-etiqa-yellow/5 transition-all text-sm font-mono tracking-wider uppercase placeholder:text-slate-400 text-slate-800"
                />
              </div>

              {/* Search Date */}
              <div className="relative flex-1 sm:max-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-etiqa-black/30">
                  <Calendar size={18} />
                </div>
                <input
                  type="date"
                  autoComplete="off"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-etiqa-yellow/50 focus:ring-4 focus:ring-etiqa-yellow/5 transition-all text-sm font-mono text-slate-600"
                />
                {searchDate && (
                  <button 
                    onClick={() => setSearchDate('')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">System ID</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Operator</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Timestamp</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Metadata</th>
                  <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
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
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-300">
                          <Package className="mb-4 opacity-20" size={64} />
                          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                            {searchQuery || searchDate
                              ? `No matching records found in system` 
                              : 'System database is empty'}
                          </p>
                        </div>
                      </td>
                    </motion.tr>
                  ) : (
                    filteredItems.map((item) => (
                      <motion.tr
                        key={item.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-blue-50/30 transition-colors group"
                      >
                        <td className="px-6 py-5">
                          <span className="font-mono font-bold text-etiqa-black bg-etiqa-yellow px-3 py-1.5 rounded-lg text-xs border border-etiqa-black/5">
                            {item.code}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-800">{item.name}</p>
                        </td>
                        <td className="px-6 py-5 text-slate-500 font-mono text-xs">
                          {new Date(item.date).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }).replace(/\//g, '.')}
                        </td>
                        <td className="px-6 py-5 text-slate-400 text-xs italic max-w-[200px] truncate">
                          {item.description || '---'}
                        </td>
                        <td className="px-6 py-5 text-right">
                          {role === 'admin' && (
                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEdit(item)}
                                className="text-slate-400 hover:text-etiqa-black p-2 rounded-lg hover:bg-etiqa-yellow/10 transition-all"
                                title="Edit Record"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteItemId(item.id)}
                                className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"
                                title="Purge Record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
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
          <div className="md:hidden space-y-6">
            <AnimatePresence mode="popLayout">
              {filteredItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-12 text-center"
                >
                  <Package className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">
                    No records found
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
                    className="p-6 relative overflow-hidden group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="font-mono font-bold text-etiqa-black bg-etiqa-yellow px-3 py-1 rounded-lg text-[10px] border border-etiqa-black/5 uppercase">
                        {item.code}
                      </span>
                      {role === 'admin' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-slate-400 hover:text-etiqa-black p-2 transition-colors"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteItemId(item.id)}
                            className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-slate-900 text-xl mb-2">{item.name}</h3>
                    
                    <div className="flex items-center gap-2 text-slate-500 font-mono text-xs mb-4">
                      <Calendar size={14} className="text-etiqa-yellow" />
                      {new Date(item.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>

                    {item.description && (
                      <div className="bg-slate-50 p-4 rounded-xl text-slate-500 text-xs italic border border-slate-100 flex items-start gap-3">
                        <Info size={14} className="mt-0.5 shrink-0 text-etiqa-yellow" />
                        {item.description}
                      </div>
                    )}
                    
                    {/* Cyber accent */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-etiqa-yellow" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </>
    ) : (
      <div className="space-y-12">
        {/* Module Upload Form - Admin Only */}
        <AnimatePresence>
          {role === 'admin' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="glass-card p-8 rounded-3xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-etiqa-yellow" />
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-tight">
                <BookOpen size={20} className="text-etiqa-yellow" />
                {editingModuleId ? 'Update Asset' : 'Asset Deployment'}
              </h2>
              <form onSubmit={addModule} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Asset Title</label>
                    <input
                      type="text"
                      value={moduleTitle}
                      onChange={(e) => setModuleTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full input-field text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Drive Link</label>
                    <input
                      type="url"
                      value={moduleLink}
                      onChange={(e) => setModuleLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full input-field text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  {editingModuleId && (
                    <button
                      type="button"
                      onClick={cancelEditModule}
                      className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isAddingModule}
                    className="flex-[2] py-4 neon-button flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]"
                  >
                    {isAddingModule ? (
                      <span>PROCESSING_DATA...</span>
                    ) : (
                      <>
                        {editingModuleId ? <Pencil size={20} /> : <Plus size={20} />}
                        {editingModuleId ? 'UPDATE_ASSET' : 'DEPLOY_ASSET'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Modules List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {modules.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full glass-card p-20 rounded-3xl text-center"
              >
                <BookOpen className="mx-auto text-slate-200 mb-6" size={80} />
                <p className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.3em]">No assets available in repository</p>
              </motion.div>
            ) : (
              modules.map((module) => (
                <motion.div
                  key={module.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card p-6 rounded-3xl group transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-etiqa-yellow opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-4 rounded-xl border bg-etiqa-yellow/10 border-etiqa-yellow/20 text-etiqa-black">
                      <BookOpen size={28} />
                    </div>
                    {role === 'admin' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditModule(module)}
                          className="text-slate-300 hover:text-etiqa-black p-2 transition-colors"
                        >
                          <Pencil size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteModuleId(module.id)}
                          className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-slate-900 text-lg mb-1 line-clamp-2 uppercase tracking-tight">{module.title}</h3>
                  <div className="h-4" /> {/* Spacer */}
                  
                  <div className="flex gap-3">
                    <a
                      href={module.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-etiqa-yellow text-etiqa-black text-[10px] font-bold rounded-xl hover:bg-[#e6bc00] transition-all uppercase tracking-widest shadow-sm border border-etiqa-black/5"
                    >
                      <ExternalLink size={14} />
                      Buka Modul
                    </a>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    )}
  </div>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-sm rounded-3xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-etiqa-yellow" />
              <div className="p-8">
                <div className="flex items-center justify-center w-20 h-20 bg-etiqa-yellow/10 text-etiqa-black rounded-2xl mx-auto mb-8 border border-etiqa-yellow/20 shadow-sm">
                  <Package size={40} />
                </div>
                <h2 className="text-2xl font-bold text-center text-slate-900 mb-2 uppercase tracking-tight">System Access</h2>
                <p className="text-slate-400 text-center text-[10px] font-mono mb-10 uppercase tracking-[0.2em]">Authentication Required</p>
                
                <form onSubmit={handleAdminLogin} className="space-y-6">
                  <div>
                    <input
                      type="password"
                      autoFocus
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="ENTER KEYCODE"
                      className={`w-full px-6 py-4 bg-white border rounded-2xl focus:outline-none focus:ring-4 transition-all text-center text-xl tracking-[0.5em] font-mono ${
                        loginError ? 'border-red-500 ring-red-500/5 text-red-600' : 'border-slate-200 focus:ring-etiqa-yellow/10 text-etiqa-black'
                      }`}
                    />
                    {loginError && (
                      <p className="text-red-500 text-[10px] font-bold mt-3 text-center uppercase tracking-widest">Access Denied: Invalid Key</p>
                    )}
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLoginModal(false);
                        setLoginPassword('');
                        setLoginError(false);
                      }}
                      className="flex-1 py-4 text-slate-400 font-bold hover:text-slate-600 transition-all uppercase text-[10px] tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 neon-button uppercase text-[10px] tracking-widest"
                    >
                      Authorize
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
        {(deleteItemId || deleteModuleId) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-sm rounded-3xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
              <div className="p-8">
                <div className="flex items-center gap-4 text-red-500 mb-6">
                  <div className="p-3 bg-red-50 rounded-xl border border-red-500/10">
                    <Trash2 size={28} />
                  </div>
                  <h3 className="text-2xl font-bold uppercase tracking-tight text-slate-900">Purge Confirmation</h3>
                </div>
                
                <p className="text-slate-500 text-xs font-mono mb-8 uppercase tracking-wider leading-relaxed">
                  Warning: {deleteItemId ? 'Registry record' : 'Asset'} will be permanently purged from system. Enter authorization key to proceed.
                </p>

                <form onSubmit={handleConfirmDelete} className="space-y-6">
                  <div>
                    <input
                      type="password"
                      autoFocus
                      placeholder="KEYWORD"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError(false);
                      }}
                      className={`w-full px-6 py-4 bg-white border rounded-2xl focus:outline-none focus:ring-4 transition-all text-center text-lg tracking-[0.3em] font-mono ${
                        deleteError 
                          ? 'border-red-500 ring-red-500/5 text-red-600' 
                          : 'border-slate-200 focus:ring-red-500/5 text-slate-800'
                      }`}
                    />
                    {deleteError && (
                      <p className="text-red-500 text-[10px] font-bold mt-3 text-center uppercase tracking-widest">
                        Invalid Authorization Key
                      </p>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteItemId(null);
                        setDeleteModuleId(null);
                        setDeletePassword('');
                        setDeleteError(false);
                      }}
                      className="flex-1 px-4 py-4 font-bold text-slate-400 hover:text-slate-600 transition-all uppercase text-[10px] tracking-widest"
                    >
                      Abort
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-4 font-bold text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all shadow-lg shadow-red-500/20 uppercase text-[10px] tracking-widest"
                    >
                      Execute Purge
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
