import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { X, Save, Sparkles, Image as ImageIcon } from 'lucide-react';

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit: InventoryItem | null;
  onSave: (item: any) => void;
  categories: string[];
  locations: string[];
}

export default function AssetFormModal({
  isOpen,
  onClose,
  itemToEdit,
  onSave,
  categories,
  locations
}: AssetFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'Asset' | 'Supply'>('Asset');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState(1);
  const [location, setLocation] = useState('');
  const [custodian, setCustodian] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'IN STOCK' | 'DAMAGED' | 'BORROWED' | 'RETIRED'>('ACTIVE');
  const [serialNumber, setSerialNumber] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState('');

  // Prepopulate form when editing or opening to add
  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setType(itemToEdit.type);
      setCategory(itemToEdit.category);
      setQty(itemToEdit.qty);
      setLocation(itemToEdit.location);
      setCustodian(itemToEdit.custodian);
      setStatus(itemToEdit.status);
      setSerialNumber(itemToEdit.serialNumber);
      setDescription(itemToEdit.description);
      setNotes(itemToEdit.notes || '');
      setImage(itemToEdit.image);
    } else {
      // Setup default new item values
      setName('');
      setType('Asset');
      setCategory(categories[0] || 'IT Equipment');
      setQty(1);
      setLocation(locations[0] || 'Main Office');
      setCustodian('');
      setStatus('ACTIVE');
      // Auto-generate a neat serial number
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setSerialNumber(`SN-${randNum}`);
      setDescription('');
      setNotes('');
      // Set a nice default placeholder image
      setImage('https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80');
    }
  }, [itemToEdit, isOpen]);

  // Adjust status based on type
  useEffect(() => {
    if (!itemToEdit) {
      if (type === 'Supply') {
        setStatus('IN STOCK');
      } else {
        setStatus('ACTIVE');
      }
    }
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: itemToEdit?.id, // Keep ID if editing
      name: name.trim(),
      type,
      category,
      qty: Number(qty),
      location,
      custodian: custodian.trim() || 'Admin',
      custodianInitial: (custodian.trim() || 'Admin').charAt(0).toUpperCase(),
      status,
      serialNumber: serialNumber.trim(),
      description: description.trim(),
      notes: notes.trim(),
      image: image.trim() || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80'
    });
  };

  // Generate AI details for items to save time!
  const handleAutoFillDetails = () => {
    if (!name) return;
    
    // Provide nice Thai details based on item name
    if (name.toLowerCase().includes('macbook') || name.toLowerCase().includes('mac')) {
      setDescription('แล็ปท็อปประสิทธิภาพสูงสำหรับการประมวลผลและการออกแบบกราฟิก หน้าจอ Retina สว่างคมชัด');
      setCategory('IT Equipment');
      setImage('https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80');
    } else if (name.toLowerCase().includes('ipad') || name.toLowerCase().includes('tablet')) {
      setDescription('แท็บเล็ตหน้าจอสัมผัสแบบพกพาสะดวก รองรับการใช้งานปากกาเขียนหน้าจอ เหมาะสำหรับการตรวจเช็คงานนอกสถานที่');
      setCategory('IT Equipment');
      setImage('https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80');
    } else if (name.toLowerCase().includes('dell') || name.toLowerCase().includes('laptop')) {
      setDescription('คอมพิวเตอร์พกพาสำหรับการทำงานทั่วไปและงานบริหารสำนักงาน ระบบปฏิบัติการ Windows มีพอร์ตเชื่อมต่อครบครัน');
      setCategory('IT Equipment');
      setImage('https://lh3.googleusercontent.com/aida-public/AB6AXuAOYBXM4LXBGCq-VLlco7N4otdSI29bvFg19Towby6N7xkRAxCKfd8qZDadnbyqQl4YwpFQWskKnkayxTBsbtWCwBaRzbDu8AwWQ7zMIXKk2Rxb6jKQG9ce_pEm2PpuhwhqR959wlFse710AmvPV9NCTaWOEyeWlj04-_QfGsnmaQTFWyytS1LF1JCAubzh_KnY4GNIMHO8mmRRvrfFikm6mPX9HKc_KM0JBZleumZV_Wfsm6U_mIiDRg');
    } else if (name.toLowerCase().includes('chair') || name.toLowerCase().includes('เก้าอี้')) {
      setDescription('เก้าอี้สำนักงานสุขภาพ ปรับระดับความสูงและเอนหลังได้ มีล้อลื่นหมุนได้รอบทิศทาง');
      setCategory('Furniture');
      setImage('https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80');
    } else if (name.toLowerCase().includes('table') || name.toLowerCase().includes('โต๊ะ')) {
      setDescription('โต๊ะทำงานโครงสร้างไม้และขาเหล็กแข็งแรง ทนทาน พื้นที่หน้ากว้างขวาง เหมาะสำหรับวางคอมพิวเตอร์และอุปกรณ์เครื่องเขียน');
      setCategory('Furniture');
      setImage('https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=600&q=80');
    } else if (name.toLowerCase().includes('printer') || name.toLowerCase().includes('พิมพ์')) {
      setDescription('เครื่องพิมพ์สำนักงานมัลติฟังก์ชัน รองรับการสแกน ถ่ายเอกสาร และสั่งพิมพ์ไร้สายผ่านเครือข่าย');
      setCategory('IT Equipment');
      setImage('https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=600&q=80');
    } else {
      setDescription('อุปกรณ์สิ่งของเครื่องใช้ของสำนักงานส่วนกลาง สภาพดีพร้อมใช้งาน ได้รับการขึ้นทะเบียนแล้ว');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-fade-in">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">
              {itemToEdit ? 'edit_document' : 'add_circle'}
            </span>
            <span className="font-bold">
              {itemToEdit ? 'แก้ไขข้อมูลครุภัณฑ์ / สิ่งของ' : 'เพิ่มทะเบียนครุภัณฑ์ / สิ่งของใหม่'}
            </span>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Quick Auto-fill Assist */}
          {!itemToEdit && (
            <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                <span>พิมพ์ชื่อสิ่งของ (เช่น iPad, เก้าอี้) แล้วให้ระบบเติมรายละเอียดและรูปตัวอย่างอัตโนมัติ!</span>
              </div>
              <button
                type="button"
                onClick={handleAutoFillDetails}
                disabled={!name}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 transition-all shadow-sm"
              >
                แนะนำข้อมูลให้
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left side: Basic Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ชื่ออุปกรณ์ / สิ่งของ *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น MacBook Pro 16 นิ้ว, แฟ้มเอกสาร"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ประเภท</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'Asset' | 'Supply')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm bg-white"
                  >
                    <option value="Asset">ครุภัณฑ์ (Asset)</option>
                    <option value="Supply">วัสดุสิ้นเปลือง (Supply)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">หมวดหมู่</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">จำนวนที่ตรวจนับ</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">รหัสครุภัณฑ์ / ซีเรียลนัมเบอร์</label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="เช่น 5420-9912"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">สถานที่ตั้ง</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm bg-white"
                >
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right side: Custodian, Status, Image & Description */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ผู้รับผิดชอบ / ผู้ดูแล</label>
                  <input
                    type="text"
                    value={custodian}
                    onChange={(e) => setCustodian(e.target.value)}
                    placeholder="ชื่อผู้รับผิดชอบ"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">สถานะ</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm bg-white"
                  >
                    <option value="ACTIVE">ใช้งานอยู่ (ACTIVE)</option>
                    <option value="IN STOCK">ในคลัง (IN STOCK)</option>
                    <option value="DAMAGED">ชำรุด (DAMAGED)</option>
                    <option value="BORROWED">ถูกยืม (BORROWED)</option>
                    <option value="RETIRED">จำหน่ายออก (RETIRED)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ลิงก์รูปภาพสิ่งของ (URL)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <ImageIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">รายละเอียดทางกายภาพ</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="รายละเอียด เช่น แบรนด์ รุ่น สเปค สี สภาพภายนอก"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">บันทึกช่วยจำเพิ่มเติม / ประวัติสั้น</label>
                <textarea
                  rows={1}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เช่น เพิ่งซ่อมแซมไป มีรอยขีดข่วนด้านหน้า"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-sm"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30"
            >
              <Save className="w-4 h-4" />
              <span>{itemToEdit ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลใหม่'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
