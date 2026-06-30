'use client';

import React, { useState, useEffect } from 'react';
import { InventoryItem, ActivityLog, ActiveTab } from '../types';
import { 
  INITIAL_ITEMS, 
  INITIAL_LOGS, 
  CATEGORIES, 
  LOCATIONS, 
  STATUS_OPTIONS 
} from '../data';

import QrScannerModal from '../components/QrScannerModal';
import AssetFormModal from '../components/AssetFormModal';
import OverviewTab from '../components/OverviewTab';
import LocationsTab from '../components/LocationsTab';
import ReportsTab from '../components/ReportsTab';

import { 
  Plus, Edit, Trash2, Download, RefreshCw, Search, Settings, 
  HelpCircle, Home, ChevronRight, ChevronDown, Grid, FolderOpen, Folder, 
  MapPin, BarChart2, Archive, Trash, PlusCircle, CheckCircle, 
  Copy, MessageSquare, Calendar, Check, AlertCircle, X,
  LayoutGrid, List, ArrowLeft, ArrowRight, Laptop, Armchair, Printer, FileText
} from 'lucide-react';

export default function NextAppPage() {
  // State for inventory items and logs, loading from localStorage or defaulting
  const [items, setItems] = useState<InventoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('office_inventory_items');
      return saved ? JSON.parse(saved) : INITIAL_ITEMS;
    }
    return INITIAL_ITEMS;
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('office_inventory_logs');
      return saved ? JSON.parse(saved) : INITIAL_LOGS;
    }
    return INITIAL_LOGS;
  });

  // Navigation and filtering
  const [activeTab, setActiveTab] = useState<ActiveTab>('Assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>('item-1');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  // File Explorer view configurations
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string | null>(null);

  // Folder tree toggle states
  const [assetsFolderExpanded, setAssetsFolderExpanded] = useState(true);
  const [locationsFolderExpanded, setLocationsFolderExpanded] = useState(true);

  // Navigation history for Back/Forward explorer buttons
  const [navigationHistory, setNavigationHistory] = useState<ActiveTab[]>(['Assets']);
  const [historyPointer, setHistoryPointer] = useState(0);

  // Modals state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

  // Notifications and feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [itemNoteText, setItemNoteText] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Sync state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('office_inventory_items', JSON.stringify(items));
    }
  }, [items]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('office_inventory_logs', JSON.stringify(logs));
    }
  }, [logs]);

  // Handle standard tab change and update history
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedItemIds([]);
    setSearchQuery('');
    setSelectedCategoryFilter(null);
    setSelectedLocationFilter(null);

    // Update back-forward explorer history
    const newHistory = navigationHistory.slice(0, historyPointer + 1);
    newHistory.push(tab);
    setNavigationHistory(newHistory);
    setHistoryPointer(newHistory.length - 1);
  };

  // Back/Forward triggers
  const handleGoBack = () => {
    if (historyPointer > 0) {
      const newPointer = historyPointer - 1;
      setHistoryPointer(newPointer);
      const tab = navigationHistory[newPointer];
      setActiveTab(tab);
      setSelectedItemIds([]);
      setSearchQuery('');
      setSelectedCategoryFilter(null);
      setSelectedLocationFilter(null);
    }
  };

  const handleGoForward = () => {
    if (historyPointer < navigationHistory.length - 1) {
      const newPointer = historyPointer + 1;
      setHistoryPointer(newPointer);
      const tab = navigationHistory[newPointer];
      setActiveTab(tab);
      setSelectedItemIds([]);
      setSearchQuery('');
      setSelectedCategoryFilter(null);
      setSelectedLocationFilter(null);
    }
  };

  // Utility toast messenger
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Quick helper to fetch selected inspected item
  const inspectedItem = items.find(item => item.id === selectedItemId);

  // Handlers for Add/Edit/Delete
  const handleSaveItem = (itemData: any) => {
    const timestamp = new Date().toISOString();
    
    if (itemData.id) {
      // Edit mode
      const oldItem = items.find(i => i.id === itemData.id);
      setItems(prev => prev.map(item => item.id === itemData.id ? { ...item, ...itemData } : item));
      
      // Log editing activity
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        itemId: itemData.id,
        itemName: itemData.name,
        action: 'แก้ไขข้อมูลครุภัณฑ์',
        details: `อัปเดตข้อมูลรายละเอียดครุภัณฑ์: ${
          oldItem?.location !== itemData.location ? `ย้ายสถานที่จาก ${oldItem?.location} ไป ${itemData.location}` : ''
        } ${oldItem?.status !== itemData.status ? `เปลี่ยนสถานะเป็น ${itemData.status}` : ''} แก้ไขข้อมูลความสมบูรณ์สำเร็จ`,
        user: 'คุณ (ผู้ใช้งาน)',
        timestamp
      };
      setLogs(prev => [newLog, ...prev]);
      triggerToast('แก้ไขข้อมูลสิ่งของสำเร็จ!');
    } else {
      // Create mode
      const newItemId = `item-${Date.now()}`;
      const newItem: InventoryItem = {
        ...itemData,
        id: newItemId,
        lastAudited: new Date().toISOString().split('T')[0]
      };
      setItems(prev => [...prev, newItem]);
      setSelectedItemId(newItemId);

      // Log creation activity
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        itemId: newItemId,
        itemName: newItem.name,
        action: 'ขึ้นทะเบียนใหม่ (Created)',
        details: `เพิ่มสิ่งของเข้าระบบเรียบร้อย ตั้งรหัสซีเรียล: ${newItem.serialNumber} ที่ห้อง ${newItem.location}`,
        user: 'คุณ (ผู้ใช้งาน)',
        timestamp
      };
      setLogs(prev => [newLog, ...prev]);
      triggerToast('เพิ่มสิ่งของใหม่เรียบร้อย!');
    }
    
    setIsFormModalOpen(false);
    setItemToEdit(null);
  };

  const handleOpenAddModal = () => {
    setItemToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setItemToEdit(item);
    setIsFormModalOpen(true);
  };

  const handleDeleteItem = (itemId: string) => {
    const itemToDelete = items.find(i => i.id === itemId);
    if (!itemToDelete) return;

    if (itemToDelete.isDeleted) {
      // Permanent delete
      if (confirm(`คุณต้องการลบ "${itemToDelete.name}" ออกจากระบบอย่างถาวรใช่หรือไม่?`)) {
        setItems(prev => prev.filter(i => i.id !== itemId));
        if (selectedItemId === itemId) setSelectedItemId(null);
        triggerToast('ลบครุภัณฑ์อย่างถาวรสำเร็จ');
      }
    } else {
      // Soft delete to Trash
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, isDeleted: true } : item));
      
      const newLog: ActivityLog = {
        id: `log-${Date.now()}`,
        itemId,
        itemName: itemToDelete.name,
        action: 'ย้ายลงถังขยะ (Deleted)',
        details: `ย้ายอุปกรณ์ "${itemToDelete.name}" ลงในถังขยะเรียบร้อย`,
        user: 'คุณ (ผู้ใช้งาน)',
        timestamp: new Date().toISOString()
      };
      setLogs(prev => [newLog, ...prev]);
      triggerToast('ย้ายลงถังขยะชั่วคราวแล้ว (คุณสามารถกู้คืนได้)');
    }
  };

  const handleArchiveItem = (itemId: string) => {
    const itemToArchive = items.find(i => i.id === itemId);
    if (!itemToArchive) return;

    const newStatus = !itemToArchive.isArchived;
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, isArchived: newStatus } : item));
    
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      itemId,
      itemName: itemToArchive.name,
      action: newStatus ? 'เก็บเข้าคลังถาวร (Archived)' : 'นำออกจากคลังถาวร (Unarchived)',
      details: newStatus 
        ? `จัดเก็บ "${itemToArchive.name}" ลงในฐานระบบสารสนเทศประวัติศาสตร์` 
        : `กู้คืนอุปกรณ์ "${itemToArchive.name}" กลับสู่หน้าการจัดสรรงานปัจจุบัน`,
      user: 'คุณ (ผู้ใช้งาน)',
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    triggerToast(newStatus ? 'เก็บถาวรเรียบร้อย' : 'กู้คืนจากคลังเก็บถาวรสำเร็จ');
  };

  const handleRestoreFromTrash = (itemId: string) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, isDeleted: false } : item));
    triggerToast('กู้คืนอุปกรณ์สำเร็จ!');
  };

  // Quick supply quantity changers (consumables)
  const handleUpdateSupplyQty = (itemId: string, increment: boolean) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = increment ? item.qty + 1 : Math.max(0, item.qty - 1);
        
        // Log changes if quantity changes significantly or goes to zero
        if (newQty !== item.qty) {
          const newLog: ActivityLog = {
            id: `log-${Date.now()}`,
            itemId: item.id,
            itemName: item.name,
            action: 'อัปเดตจำนวนวัสดุสิ้นเปลือง',
            details: `ปรับปริมาณวัสดุ จากเดิม ${item.qty} เป็น ${newQty} ชิ้น`,
            user: 'คุณ (ผู้ใช้งาน)',
            timestamp: new Date().toISOString()
          };
          setTimeout(() => setLogs(prev => [newLog, ...prev]), 0);
        }
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  // Copying serial number with modern toast API
  const handleCopySerial = (serial: string) => {
    navigator.clipboard.writeText(serial);
    triggerToast(`คัดลอกรหัส "${serial}" ไปยังคลิปบอร์ดแล้ว!`);
  };

  // Perform quick audit on inspected item
  const handleQuickAudit = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const todayStr = new Date().toISOString().split('T')[0];
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, lastAudited: todayStr } : i));
    
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      itemId,
      itemName: item.name,
      action: 'ตรวจสอบสภาพครุภัณฑ์ (Audited)',
      details: `กดตรวจสภาพทรัพย์สินด่วน: สภาพเรียบร้อยดี ข้อมูลตรงตามฐานทะเบียนกลาง`,
      user: 'คุณ (ผู้ใช้งาน)',
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    triggerToast('บันทึกการตรวจเช็คสภาพทรัพย์สินเรียบร้อย!');
  };

  // Relocate item quickly from detailed locations explorer
  const handleUpdateItemLocation = (itemId: string, newLocation: string) => {
    const oldItem = items.find(i => i.id === itemId);
    if (!oldItem) return;

    setItems(prev => prev.map(i => i.id === itemId ? { ...i, location: newLocation } : i));
    
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      itemId,
      itemName: oldItem.name,
      action: 'ย้ายสถานที่ตั้ง',
      details: `ย้ายตำแหน่งที่ตั้งของ "${oldItem.name}" จากเดิมที่ห้อง "${oldItem.location}" ไปยังห้อง "${newLocation}"`,
      user: 'คุณ (ผู้ใช้งาน)',
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    triggerToast(`ย้ายสิ่งของไปยังห้อง ${newLocation} แล้ว`);
  };

  // Save notes handler in the inspector panel
  const handleSaveItemNotes = () => {
    if (!selectedItemId) return;
    setItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, notes: itemNoteText } : item));
    
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      itemId: selectedItemId,
      itemName: inspectedItem?.name || '',
      action: 'อัปเดตบันทึกเพิ่มเติม',
      details: `เขียนบันทึกช่วยจำสภาพทรัพย์สินใหม่: "${itemNoteText}"`,
      user: 'คุณ (ผู้ใช้งาน)',
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [newLog, ...prev]);
    
    setShowNotesDialog(false);
    triggerToast('บันทึกข้อมูลเพิ่มเติมสำเร็จ');
  };

  // Handle successful mock scanner
  const handleScanSuccess = (scannedItem: InventoryItem) => {
    setSelectedItemId(scannedItem.id);
    setActiveTab('Assets');
    triggerToast(`พบข้อมูลทรัพย์สิน: ${scannedItem.name}`);
  };

  // Multi select toggler
  const handleToggleSelectAll = (filteredList: InventoryItem[]) => {
    if (selectedItemIds.length === filteredList.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredList.map(item => item.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Filter items based on active Tab, deleted status, search query, subcategory, and sublocation
  const getFilteredItems = (): InventoryItem[] => {
    return items.filter(item => {
      // 1. Filter Deleted / Archived status first
      if (activeTab === 'Trash') {
        return item.isDeleted;
      }
      if (item.isDeleted) return false;

      if (activeTab === 'Archive') {
        return item.isArchived;
      }
      if (item.isArchived) return false;

      // 2. Filter tabs
      if (activeTab === 'Assets' && item.type !== 'Asset') return false;
      if (activeTab === 'Supplies' && item.type !== 'Supply') return false;

      // 3. Subfolder Category / Location filters from sidebar file-tree
      if (selectedCategoryFilter && item.category !== selectedCategoryFilter) return false;
      if (selectedLocationFilter && item.location !== selectedLocationFilter) return false;

      // 4. Search query filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        return (
          item.name.toLowerCase().includes(q) ||
          item.serialNumber.toLowerCase().includes(q) ||
          item.custodian.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q)
        );
      }

      return true;
    });
  };

  const filteredItems = getFilteredItems();

  // Format relative time helper for last audited
  const getRelativeAuditedTime = (dateStr: string): string => {
    if (!dateStr) return 'ยังไม่ได้ตรวจสอบ';
    const auditDate = new Date(dateStr);
    const today = new Date('2026-06-25'); // Anchored to current metadata time
    const diffTime = Math.abs(today.getTime() - auditDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'วันนี้';
    if (diffDays === 1) return 'เมื่อวานนี้';
    if (diffDays > 365) {
      const years = Math.floor(diffDays / 365);
      return `${years} ปีที่แล้ว`;
    }
    if (diffDays > 30) {
      const months = Math.floor(diffDays / 30);
      return `${months} เดือนที่แล้ว`;
    }
    return `${diffDays} วันที่ผ่านมา`;
  };

  // Highlight rows based on status
  const getStatusBadge = (status: string) => {
    const found = STATUS_OPTIONS.find(o => o.value === status);
    return found ? (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${found.color}`}>
        <span className="w-1 h-1 rounded-full bg-current mr-1 animate-pulse"></span>
        {status}
      </span>
    ) : null;
  };

  // Get matching icon for items list
  const getTableItemIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('it') || cat.includes('tech') || cat.includes('computer')) {
      return <Laptop className="w-4 h-4 text-blue-600" />;
    }
    if (cat.includes('furniture') || cat.includes('chair')) {
      return <Armchair className="w-4 h-4 text-emerald-600" />;
    }
    if (cat.includes('av') || cat.includes('projector') || cat.includes('cam')) {
      return <Printer className="w-4 h-4 text-purple-600" />;
    }
    return <FileText className="w-4 h-4 text-slate-500" />;
  };

  // Calculate simulated monetary valuation of items in the current folder/tab
  const calculateFolderValuation = () => {
    return filteredItems.reduce((sum, item) => {
      // Simulate prices for high-fidelity stats
      let itemPrice = 1500; // Base stationery / supplies
      if (item.category.includes('IT')) itemPrice = 28000;
      else if (item.category.includes('AV')) itemPrice = 18500;
      else if (item.category.includes('Furniture')) itemPrice = 4500;
      return sum + (itemPrice * item.qty);
    }, 0);
  };

  return (
    <div className="bg-[#f1f5f9] text-[#0f172a] h-screen flex flex-col overflow-hidden font-sans relative">
      
      {/* Dynamic Floating Toast feedback */}
      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2 border border-slate-700 animate-[bounce_0.5s_ease-out_1]">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Command Bar / OS Title Bar */}
      <header className="bg-white border-b border-slate-200 flex justify-between items-center px-4 h-[52px] w-full flex-shrink-0 shadow-sm z-20 relative">
        <div className="flex items-center space-x-3">
          <span 
            className="text-lg font-black text-blue-600 flex items-center gap-1.5 select-none cursor-pointer hover:opacity-85" 
            onClick={() => handleTabChange('Overview')}
          >
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
            </div>
            <span className="tracking-tight">OfficeInventory</span>
          </span>
          <div className="h-5 w-px bg-slate-200 mx-1"></div>
          
          {/* Action Toolbar */}
          <div className="flex items-center space-x-1">
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all border border-transparent bg-slate-50 hover:border-slate-200 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-green-600 stroke-[3px]" />
              <span>Add</span>
            </button>
            <button 
              disabled={!selectedItemId}
              onClick={() => inspectedItem && handleOpenEditModal(inspectedItem)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all disabled:opacity-40"
            >
              <Edit className="w-3.5 h-3.5 text-blue-500" />
              <span>Edit</span>
            </button>
            <button 
              disabled={!selectedItemId}
              onClick={() => selectedItemId && handleDeleteItem(selectedItemId)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Delete</span>
            </button>
            <button 
              onClick={() => {
                if (activeTab === 'Reports') return;
                handleTabChange('Reports');
                triggerToast('เตรียมพร้อมพิมพ์สรุปรายงานพัสดุ');
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5 text-purple-500" />
              <span>Export</span>
            </button>
            <button 
              onClick={() => {
                setItems(INITIAL_ITEMS);
                setLogs(INITIAL_LOGS);
                setSelectedCategoryFilter(null);
                setSelectedLocationFilter(null);
                triggerToast('รีเฟรชคืนค่าระบบและสารบัญทั้งหมดสำเร็จ');
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Global Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 w-64 placeholder-slate-400 transition-all text-slate-800 font-medium" 
              placeholder="ค้นหาด่วนในห้องนี้..." 
              type="text"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-1 text-slate-600">
            <button onClick={() => triggerToast('เปิดตู้ควบคุมระบบส่วนกลาง')} className="hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => triggerToast('คู่มือการประทับตราพัสดุ: เลือกไฟล์แล้วกด Audit Now')} className="hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
              <HelpCircle className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs ml-1 cursor-pointer shadow-sm border border-white">
              JS
            </div>
          </div>
        </div>
      </header>

      {/* Address Bar / Breadcrumbs Container (Like real Finder / Windows Explorer) */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0 z-10 select-none">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          
          {/* History Navigation Arrows */}
          <div className="flex items-center space-x-1 mr-2 flex-shrink-0">
            <button 
              onClick={handleGoBack}
              disabled={historyPointer === 0}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 transition-colors"
              title="ย้อนกลับ"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleGoForward}
              disabled={historyPointer === navigationHistory.length - 1}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 transition-colors"
              title="ถัดไป"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* breadcrumb Directory Route */}
          <div className="flex items-center text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex-1 max-w-xl shadow-inner font-mono overflow-x-auto whitespace-nowrap">
            <Home className="w-3.5 h-3.5 mr-1 text-blue-600 flex-shrink-0" />
            <span className="hover:text-blue-600 cursor-pointer hover:underline" onClick={() => handleTabChange('Overview')}>root</span>
            <ChevronRight className="w-3 h-3 mx-1 text-slate-300 flex-shrink-0" />
            
            <span className="hover:text-blue-600 cursor-pointer hover:underline" onClick={() => handleTabChange(activeTab)}>
              {activeTab === 'Assets' ? 'assets' : activeTab === 'Supplies' ? 'supplies' : activeTab.toLowerCase()}
            </span>

            {selectedCategoryFilter && (
              <>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300 flex-shrink-0" />
                <span className="text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {selectedCategoryFilter.toLowerCase().replace(/\s+/g, '-')}
                </span>
              </>
            )}

            {selectedLocationFilter && (
              <>
                <ChevronRight className="w-3 h-3 mx-1 text-slate-300 flex-shrink-0" />
                <span className="text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {selectedLocationFilter.toLowerCase().replace(/\s+/g, '-')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* View Mode Switcher (List vs Grid) */}
        <div className="flex items-center space-x-1 bg-slate-200/60 p-0.5 rounded-lg border border-slate-200 flex-shrink-0 ml-4">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            title="แสดงผลแบบตาราง (List)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            title="แสดงผลแบบโฟลเดอร์/ไอคอน (Icons)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 3-Column Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar (OS Style Interactive Directory Explorer Tree) */}
        <aside className="w-[260px] bg-white flex flex-col py-3.5 h-full border-r border-slate-200 flex-shrink-0 z-10 select-none overflow-y-auto">
          <div className="px-4 pb-4 border-b border-slate-100 mb-3">
            <h2 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Directory Tree</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inventory File System</p>
            <button 
              onClick={handleOpenAddModal}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-blue-500/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ขึ้นทะเบียนใหม่</span>
            </button>
          </div>

          {/* Interactive File System Directory Hierarchy */}
          <nav className="flex-1 px-2.5 space-y-0.5 text-xs font-medium text-slate-600">
            
            {/* 1. Overview */}
            <button 
              onClick={() => handleTabChange('Overview')}
              className={`w-full flex items-center px-2.5 py-2 rounded-lg transition-all ${
                activeTab === 'Overview' 
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50' 
                  : 'hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Grid className="w-4 h-4 mr-2.5 text-slate-400" />
              <span>Overview Console</span>
            </button>

            {/* 2. Collapsible Assets (ครุภัณฑ์) Folder */}
            <div className="space-y-0.5">
              <div 
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                  activeTab === 'Assets' && !selectedCategoryFilter
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50' 
                    : 'hover:bg-slate-50 hover:text-slate-800'
                }`}
                onClick={() => {
                  handleTabChange('Assets');
                }}
              >
                <div className="flex items-center min-w-0">
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssetsFolderExpanded(!assetsFolderExpanded);
                    }}
                    className="p-0.5 hover:bg-slate-200/50 rounded mr-1 transition-colors"
                  >
                    {assetsFolderExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </span>
                  <Folder className="w-4 h-4 mr-2 text-amber-500 fill-amber-400 flex-shrink-0" />
                  <span className="truncate">Assets (ครุภัณฑ์)</span>
                </div>
                <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {items.filter(i => i.type === 'Asset' && !i.isDeleted && !i.isArchived).length}
                </span>
              </div>

              {/* Subfolders for categories */}
              {assetsFolderExpanded && (
                <div className="pl-6 border-l border-slate-200 ml-4 space-y-0.5">
                  {CATEGORIES.map(cat => {
                    const isCurrent = selectedCategoryFilter === cat && activeTab === 'Assets';
                    const count = items.filter(i => i.category === cat && i.type === 'Asset' && !i.isDeleted && !i.isArchived).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveTab('Assets');
                          setSelectedCategoryFilter(cat);
                          setSelectedLocationFilter(null);
                          setSelectedItemIds([]);
                        }}
                        className={`w-full text-left py-1.5 px-2.5 rounded-md flex items-center justify-between transition-colors ${
                          isCurrent 
                            ? 'bg-blue-100/60 text-blue-700 font-bold' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <div className="flex items-center min-w-0">
                          {getTableItemIcon(cat)}
                          <span className="ml-2 truncate">{cat}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Supplies Folder */}
            <button 
              onClick={() => handleTabChange('Supplies')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-all ${
                activeTab === 'Supplies' 
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50' 
                  : 'hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center">
                <Folder className="w-4 h-4 mr-2.5 text-amber-500 fill-amber-400" />
                <span>Supplies (วัสดุสิ้นเปลือง)</span>
              </div>
              <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {items.filter(i => i.type === 'Supply' && !i.isDeleted && !i.isArchived).length}
              </span>
            </button>

            {/* 4. Collapsible Locations (สถานที่ตั้ง) Folder */}
            <div className="space-y-0.5">
              <div 
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                  activeTab === 'Locations' && !selectedLocationFilter
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50' 
                    : 'hover:bg-slate-50 hover:text-slate-800'
                }`}
                onClick={() => {
                  handleTabChange('Locations');
                }}
              >
                <div className="flex items-center min-w-0">
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocationsFolderExpanded(!locationsFolderExpanded);
                    }}
                    className="p-0.5 hover:bg-slate-200/50 rounded mr-1 transition-colors"
                  >
                    {locationsFolderExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </span>
                  <MapPin className="w-4 h-4 mr-2 text-rose-500 flex-shrink-0" />
                  <span className="truncate">Locations (สถานที่ตั้ง)</span>
                </div>
                <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {LOCATIONS.length}
                </span>
              </div>

              {/* Subfolders for locations */}
              {locationsFolderExpanded && (
                <div className="pl-6 border-l border-slate-200 ml-4 space-y-0.5">
                  {LOCATIONS.map(loc => {
                    const isCurrent = selectedLocationFilter === loc && activeTab === 'Locations';
                    const count = items.filter(i => i.location === loc && !i.isDeleted && !i.isArchived).length;
                    return (
                      <button
                        key={loc}
                        onClick={() => {
                          setActiveTab('Locations');
                          setSelectedLocationFilter(loc);
                          setSelectedCategoryFilter(null);
                          setSelectedItemIds([]);
                        }}
                        className={`w-full text-left py-1.5 px-2.5 rounded-md flex items-center justify-between transition-colors ${
                          isCurrent 
                            ? 'bg-blue-100/60 text-blue-700 font-bold' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <span className="truncate">{loc}</span>
                        <span className="text-[9px] font-bold text-slate-400">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Reports (สรุปรายงาน) */}
            <button 
              onClick={() => handleTabChange('Reports')}
              className={`w-full flex items-center px-2.5 py-2 rounded-lg transition-all ${
                activeTab === 'Reports' 
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/50' 
                  : 'hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <BarChart2 className="w-4 h-4 mr-2.5 text-slate-400" />
              <span>Reports & Analytics</span>
            </button>
          </nav>

          <div className="px-2 pt-3 border-t border-slate-100 mt-auto text-xs">
            <button 
              onClick={() => handleTabChange('Archive')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-all ${
                activeTab === 'Archive' ? 'bg-slate-100 text-slate-800 font-bold' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center">
                <Archive className="w-4 h-4 mr-2.5 text-slate-400" />
                <span>Archive</span>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
                {items.filter(i => i.isArchived).length}
              </span>
            </button>
            <button 
              onClick={() => handleTabChange('Trash')}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-all ${
                activeTab === 'Trash' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-500 hover:bg-red-50 hover:text-red-600'
              }`}
            >
              <div className="flex items-center">
                <Trash className="w-4 h-4 mr-2.5 text-red-400" />
                <span>Trash (ถังขยะ)</span>
              </div>
              <span className="text-[10px] font-bold bg-red-100 px-1.5 py-0.5 rounded text-red-500">
                {items.filter(i => i.isDeleted).length}
              </span>
            </button>
          </div>
        </aside>

        {/* Center Main Content Container (Visual Files Listing) */}
        <main className="flex-1 bg-white flex flex-col min-w-0 relative">
          
          {/* Main workspace tabs */}
          {activeTab === 'Overview' ? (
            <OverviewTab 
              items={items} 
              logs={logs} 
              onNavigateToTab={handleTabChange}
              onQuickAdd={handleOpenAddModal}
            />
          ) : activeTab === 'Locations' && !selectedLocationFilter ? (
            <LocationsTab 
              items={items} 
              locations={LOCATIONS} 
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onUpdateItemLocation={handleUpdateItemLocation}
            />
          ) : activeTab === 'Reports' ? (
            <ReportsTab items={items} />
          ) : (
            <>
              {/* FILE EXPLORER MAIN VIEWS (Grid or List view toggle supported) */}

              {viewMode === 'list' ? (
                // 1. DETAIL LIST VIEW (Table look)
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex items-center px-4 py-2 border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10 select-none">
                    <div className="w-8 flex-shrink-0 flex items-center justify-center">
                      <input 
                        type="checkbox"
                        checked={filteredItems.length > 0 && selectedItemIds.length === filteredItems.length}
                        onChange={() => handleToggleSelectAll(filteredItems)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                    </div>
                    <div className="w-8 flex-shrink-0"></div>
                    <div className="flex-1 min-w-[150px] pl-2">Name</div>
                    <div className="w-20 flex-shrink-0">Type</div>
                    <div className="w-28 flex-shrink-0">Category</div>
                    <div className="w-14 flex-shrink-0 text-center">Qty</div>
                    <div className="w-28 flex-shrink-0">Location</div>
                    <div className="w-24 flex-shrink-0">Custodian</div>
                    <div className="w-24 flex-shrink-0">Status</div>
                    <div className="w-24 flex-shrink-0 text-right pr-2">Last Audited</div>
                  </div>

                  <div className="overflow-y-auto flex-1 p-2 space-y-1 bg-slate-50/20">
                    {filteredItems.map((item) => {
                      const isSelected = selectedItemId === item.id;
                      const isChecked = selectedItemIds.includes(item.id);

                      return (
                        <div 
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={`flex items-center px-3 py-2 rounded-lg border cursor-pointer relative transition-all ${
                            isSelected 
                              ? 'bg-blue-50 border-blue-200 text-slate-900 ring-1 ring-blue-100' 
                              : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700'
                          }`}
                        >
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectItem(item.id);
                            }}
                            className="w-8 flex-shrink-0 flex items-center justify-center"
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </div>

                          <div className="w-8 flex-shrink-0 flex items-center justify-center bg-slate-100 p-1.5 rounded">
                            {getTableItemIcon(item.category)}
                          </div>

                          <div className="flex-1 min-w-[150px] font-bold text-slate-800 truncate pl-2">
                            {item.name}
                          </div>

                          <div className="w-20 flex-shrink-0">
                            <span className="bg-slate-100 text-slate-600 border border-slate-200/60 px-2 py-0.5 rounded text-[10px] font-semibold">
                              {item.type}
                            </span>
                          </div>

                          <div className="w-28 flex-shrink-0 text-xs font-semibold text-slate-500 truncate">
                            {item.category}
                          </div>

                          <div className="w-14 flex-shrink-0 text-center font-bold">
                            {item.type === 'Supply' && !item.isDeleted && !item.isArchived ? (
                              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                                <button 
                                  onClick={() => handleUpdateSupplyQty(item.id, false)}
                                  className="w-4 h-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded flex items-center justify-center text-xs transition-colors"
                                >
                                  -
                                </button>
                                <span className="w-4 text-center font-black text-slate-800 text-[11px]">{item.qty}</span>
                                <button 
                                  onClick={() => handleUpdateSupplyQty(item.id, true)}
                                  className="w-4 h-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded flex items-center justify-center text-xs transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-800 font-black text-xs">{item.qty}</span>
                            )}
                          </div>

                          <div className="w-28 flex-shrink-0 text-xs font-semibold text-slate-500 truncate flex items-center">
                            <span className="material-symbols-outlined text-[13px] mr-0.5 text-slate-400">location_on</span>
                            {item.location}
                          </div>

                          <div className="w-24 flex-shrink-0 text-xs font-bold text-slate-600 truncate flex items-center">
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold mr-1.5 shadow-sm">
                              {item.custodianInitial || item.custodian.charAt(0).toUpperCase()}
                            </div>
                            {item.custodian}
                          </div>

                          <div className="w-24 flex-shrink-0">
                            {getStatusBadge(item.status)}
                          </div>

                          <div className="w-24 flex-shrink-0 text-right pr-2 text-[10px] font-semibold text-slate-400">
                            {getRelativeAuditedTime(item.lastAudited)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // 2. ICON / GRID VIEW (Real File Tiles explorer style!)
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/20">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 select-none">
                    {filteredItems.map((item) => {
                      const isSelected = selectedItemId === item.id;
                      const isChecked = selectedItemIds.includes(item.id);

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={`group rounded-xl border p-3 flex flex-col items-center text-center cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-100'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          {/* Top row with selection checkboxes */}
                          <div className="w-full flex justify-between items-center mb-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelectItem(item.id);
                              }}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3px]" />}
                            </button>
                            {getStatusBadge(item.status)}
                          </div>

                          {/* File Thumbnail / Previews */}
                          <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mb-3 relative overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              getTableItemIcon(item.category)
                            )}
                            
                            {/* Quantity pill overlay */}
                            <span className="absolute bottom-1 right-1 bg-slate-900/70 text-white font-black text-[9px] px-1 py-0.2 rounded">
                              x{item.qty}
                            </span>
                          </div>

                          {/* Details */}
                          <p className="font-extrabold text-xs text-slate-800 truncate w-full px-1">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{item.category}</p>
                          <p className="text-[9px] text-slate-400 font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md mt-2">
                            {item.serialNumber}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state finder style */}
              {filteredItems.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <FolderOpen className="w-12 h-12 text-slate-300" />
                  <h4 className="font-bold text-slate-700 mt-3 text-sm">ไม่พบเอกสารหรือสิ่งของในห้องนี้</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    โฟลเดอร์สารบัญนี้ว่างเปล่า คุณสามารถกดเพิ่ม &quot;ขึ้นทะเบียนใหม่&quot; หรือเปลี่ยนห้องสำรวจในแถบซ้ายมือได้ครับ
                  </p>
                </div>
              )}

              {/* StatusBar / Footer */}
              <footer className="h-[40px] border-t border-slate-200 bg-white flex items-center px-4 text-xs text-slate-500 justify-between flex-shrink-0 shadow-inner z-10">
                <div className="flex items-center space-x-4">
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold text-[11px] border border-slate-200">
                    {filteredItems.length} items
                  </span>
                  <span className="text-slate-500 font-semibold">
                    โฟลเดอร์ประเมินราคาทรัพย์สิน: <span className="text-blue-600 font-black">฿{calculateFolderValuation().toLocaleString()}</span>
                  </span>
                  {selectedItemIds.length > 0 && (
                    <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 font-bold">
                      เลือกอยู่ {selectedItemIds.length} รายการ
                    </span>
                  )}
                </div>

                {/* Bulk Actions in Trash or Main database */}
                {selectedItemIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {activeTab === 'Trash' ? (
                      <>
                        <button 
                          onClick={() => {
                            setItems(prev => prev.map(i => selectedItemIds.includes(i.id) ? { ...i, isDeleted: false } : i));
                            setSelectedItemIds([]);
                            triggerToast('กู้คืนอุปกรณ์ทั้งหมดสำเร็จ!');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded"
                        >
                          กู้คืนทั้งหมด
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('คุณต้องการลบถาวรทุกชิ้นที่เลือกไว้ใช่หรือไม่?')) {
                              setItems(prev => prev.filter(i => !selectedItemIds.includes(i.id)));
                              setSelectedItemIds([]);
                              triggerToast('ลบพัสดุถาวรเรียบร้อย');
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 py-1 rounded"
                        >
                          ลบถาวร
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => {
                          setItems(prev => prev.map(i => selectedItemIds.includes(i.id) ? { ...i, isDeleted: true } : i));
                          setSelectedItemIds([]);
                          triggerToast('ย้ายพัสดุที่เลือกไปถังขยะเรียบร้อย');
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg"
                      >
                        ส่งเข้าถังขยะ ({selectedItemIds.length})
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-1.5 text-blue-600 font-semibold">
                  <span className="material-symbols-outlined text-[15px] animate-[spin_5s_linear_infinite]">sync</span>
                  <span>Synced</span>
                </div>
              </footer>
            </>
          )}
        </main>

        {/* Right Details Pane (Finder Preview style!) */}
        {inspectedItem ? (
          <aside className="w-[320px] bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 overflow-y-auto shadow-sm z-10 select-none">
            {/* Header Image Area */}
            <div className="h-52 bg-slate-100 relative group overflow-hidden border-b border-slate-100">
              <img 
                src={inspectedItem.image} 
                alt={inspectedItem.name} 
                className="w-full h-full object-cover"
              />
              <button 
                onClick={() => handleOpenEditModal(inspectedItem)}
                className="absolute top-3 right-3 p-2 bg-white/95 hover:bg-white text-blue-600 rounded-full shadow-md backdrop-blur-sm transform hover:scale-110 transition-all cursor-pointer"
                title="แก้ไขข้อมูลครุภัณฑ์"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4.5 flex-1 flex flex-col bg-gradient-to-b from-white to-slate-50/50 space-y-4">
              
              {/* Title & Primary Status */}
              <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start gap-1">
                  <h3 className="font-extrabold text-[16px] text-slate-800 leading-snug">
                    {inspectedItem.name}
                  </h3>
                </div>
                
                <div className="flex items-center space-x-2 mt-2">
                  <span className="bg-slate-100 text-slate-600 border border-slate-200/50 px-2 py-0.5 rounded text-[10px] font-semibold">
                    {inspectedItem.category}
                  </span>
                  <span className="text-slate-300 text-xs">•</span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-blue-100">
                    {inspectedItem.type}
                  </span>
                </div>
              </div>

              {/* Properties List */}
              <div className="space-y-2.5 flex-1">
                
                {/* Serial Box */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Serial Number</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-800 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      {inspectedItem.serialNumber}
                    </p>
                    <button 
                      onClick={() => handleCopySerial(inspectedItem.serialNumber)}
                      className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-50 transition-colors"
                      title="คัดลอกรหัสพัสดุ"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Location Box */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Location</p>
                  <div className="flex items-center text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <MapPin className="w-4 h-4 mr-2 text-rose-500 bg-rose-50 p-0.5 rounded" />
                    <span>{inspectedItem.location}</span>
                  </div>
                </div>

                {/* Custodian Box */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Current Custodian</p>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center">
                      <div className="w-5.5 h-5.5 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center text-[10px] font-bold mr-2 shadow-sm border border-blue-300">
                        {inspectedItem.custodianInitial || inspectedItem.custodian.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold">{inspectedItem.custodian}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setItemNoteText(inspectedItem.notes || '');
                        setShowNotesDialog(true);
                      }}
                      className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-50 transition-colors"
                      title="ส่งโน้ตบันทึกช่วยจำ"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Last Audited and description Box */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-2">
                  <div>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Last Audited</p>
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-500" />
                        <span className="font-bold">{new Date(inspectedItem.lastAudited).toLocaleDateString('th-TH')}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-full">
                        ({getRelativeAuditedTime(inspectedItem.lastAudited)})
                      </span>
                    </div>
                  </div>
                  
                  {inspectedItem.description && (
                    <div className="border-t border-slate-50 pt-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">รายละเอียดเครื่อง</p>
                      <p className="text-[11px] text-slate-500 leading-normal font-medium">
                        {inspectedItem.description}
                      </p>
                    </div>
                  )}

                  {inspectedItem.notes && (
                    <div className="border-t border-slate-50 pt-1.5 bg-yellow-50/50 p-2 rounded-lg border border-yellow-100/50">
                      <p className="text-[9px] font-bold text-yellow-700 uppercase tracking-wider mb-0.5">บันทึกเพิ่มเติม</p>
                      <p className="text-[11px] text-yellow-800 leading-normal font-medium">
                        {inspectedItem.notes}
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 mt-auto pt-3 border-t border-slate-200">
                <button 
                  onClick={() => handleQuickAudit(inspectedItem.id)}
                  className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center space-x-1.5 transition-all font-bold text-xs border border-emerald-200"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Audit Now (ตรวจสภาพทันที)</span>
                </button>
                
                <button 
                  onClick={() => setIsQrModalOpen(true)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-1.5 transition-all font-bold text-xs shadow-md shadow-blue-500/10"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                  <span>Scan QR</span>
                </button>
                
                <button 
                  onClick={() => setShowHistoryModal(true)}
                  className="w-full py-2 bg-white border border-slate-200 rounded-lg flex items-center justify-center space-x-1.5 hover:bg-slate-50 transition-colors text-slate-700 font-semibold text-xs shadow-sm hover:border-slate-300"
                >
                  <span className="material-symbols-outlined text-[16px] text-gray-500 font-bold">history</span>
                  <span>View History</span>
                </button>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="w-[320px] bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 items-center justify-center text-center p-6 text-slate-400">
            <Folder className="w-10 h-10 text-slate-300" />
            <p className="text-xs font-bold text-slate-700 mt-2">เลือกครุภัณฑ์เพื่อพรีวิวข้อมูล</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
              คลิกเลือกพัสดุใดก็ได้ในตารางหรือสลับเข้าโหมดโฟลเดอร์รูปภาพเพื่อส่องพรีวิวอย่างรวดเร็ว
            </p>
          </aside>
        )}

      </div>

      {/* 1. QR Scanner Simulation Modal */}
      <QrScannerModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        items={items}
        onScanSuccess={handleScanSuccess}
      />

      {/* 2. Add / Edit Asset Form Modal */}
      <AssetFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setItemToEdit(null);
        }}
        itemToEdit={itemToEdit}
        onSave={handleSaveItem}
        categories={CATEGORIES}
        locations={LOCATIONS}
      />

      {/* 3. Interactive Notes & Custodian Comment dialog */}
      {showNotesDialog && inspectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl border border-slate-100 animate-fade-in space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>บันทึกโน้ตสติกเกอร์: {inspectedItem.name}</span>
              </h3>
              <button onClick={() => setShowNotesDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400">
                เขียนโน้ตติดสภาพความสมบูรณ์ ชำรุด หรือข้อมูลอัปเดตสำหรับเครื่องนี้
              </p>
              <textarea
                rows={4}
                value={itemNoteText}
                onChange={(e) => setItemNoteText(e.target.value)}
                placeholder="เช่น แป้นพิมพ์รวนบางคีย์, มีนัดหมายตรวจสภาพบำรุงในสัปดาห์หน้า..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowNotesDialog(false)}
                className="px-3 py-1.5 text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveItemNotes}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/10"
              >
                บันทึกบันทึกช่วยจำ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. History Feed Modal */}
      {showHistoryModal && inspectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-fade-in flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">history</span>
                <div>
                  <h3 className="font-bold text-xs">ประวัติการตรวจสุขภาพพัสดุและซ่อมบำรุง</h3>
                  <p className="text-[10px] text-slate-400">{inspectedItem.name} ({inspectedItem.serialNumber})</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-300 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="relative border-l-2 border-slate-100 pl-4 ml-3 space-y-4">
                {logs.filter(log => log.itemId === inspectedItem.id).map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-white"></div>
                    
                    <div className="text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span className="text-blue-700 font-bold">{log.action}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString('th-TH')}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-1 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {log.details}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 pl-1">
                        ผู้ตรวจสภาพ: <span className="font-semibold text-slate-600">{log.user}</span>
                      </p>
                    </div>
                  </div>
                ))}

                {logs.filter(log => log.itemId === inspectedItem.id).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">ไม่มีบันทึกประวัติก่อนหน้านี้</p>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
