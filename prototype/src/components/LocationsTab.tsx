import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { MapPin, Search, ChevronRight, Laptop, Armchair, Printer, HelpCircle } from 'lucide-react';

interface LocationsTabProps {
  items: InventoryItem[];
  locations: string[];
  onSelectItem: (item: InventoryItem) => void;
  onUpdateItemLocation: (itemId: string, newLocation: string) => void;
}

export default function LocationsTab({ items, locations, onSelectItem, onUpdateItemLocation }: LocationsTabProps) {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const activeItems = items.filter(item => !item.isDeleted && !item.isArchived);

  // Group items by location
  const itemsByLocation = (location: string) => {
    return activeItems.filter(item => item.location === location);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700 border-green-200';
      case 'IN STOCK': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DAMAGED': return 'bg-red-100 text-red-700 border-red-200';
      case 'BORROWED': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getItemIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('it') || cat.includes('computer')) return <Laptop className="w-4 h-4 text-blue-600" />;
    if (cat.includes('furniture') || cat.includes('chair')) return <Armchair className="w-4 h-4 text-emerald-600" />;
    if (cat.includes('av') || cat.includes('projector')) return <Printer className="w-4 h-4 text-purple-600" />;
    return <HelpCircle className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50/50">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">สำรวจตำแหน่งจัดเก็บ (Locations)</h2>
        <p className="text-xs text-slate-400">ตรวจสอบ ตรวจนับ และย้ายตำแหน่งสิ่งของระหว่างแผนกสำนักงานต่างๆ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Locations List */}
        <div className="lg:col-span-1 space-y-3">
          {locations.map((loc) => {
            const locItems = itemsByLocation(loc);
            const isSelected = selectedLocation === loc;
            
            return (
              <button
                key={loc}
                onClick={() => setSelectedLocation(isSelected ? null : loc)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/10' 
                    : 'bg-white text-slate-800 border-slate-100 hover:border-slate-200 shadow-soft'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{loc}</p>
                    <p className={`text-[11px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      มีอุปกรณ์ {locItems.length} รายการ ({locItems.reduce((sum, i) => sum + i.qty, 0)} ชิ้น)
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-white' : 'text-slate-400'}`} />
              </button>
            );
          })}
        </div>

        {/* Selected Location Items Inspect panel */}
        <div className="lg:col-span-2">
          {selectedLocation ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span>สิ่งของทั้งหมดที่ตั้งอยู่ที่: {selectedLocation}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    แสดงรายการเครื่องมือ อุปกรณ์ และวัสดุที่ผู้รับผิดชอบดูแลอยู่ที่ห้องนี้
                  </p>
                </div>
                <span className="bg-blue-600 font-bold px-2.5 py-1 rounded-full text-xs">
                  {itemsByLocation(selectedLocation).length} รายการ
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* Search in Location */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาอุปกรณ์ในสถานที่นี้..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-xs"
                  />
                </div>

                {/* Items list */}
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {itemsByLocation(selectedLocation)
                    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.serialNumber.includes(searchQuery))
                    .map((item) => (
                      <div 
                        key={item.id} 
                        className="p-3 border border-slate-100 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-all text-xs group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <h4 onClick={() => onSelectItem(item)} className="font-bold text-slate-800 hover:text-blue-600 hover:underline cursor-pointer truncate">
                              {item.name}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              S/N: {item.serialNumber} | ผู้ดูแล: {item.custodian}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Qty count badge */}
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                            {item.qty} ชิ้น
                          </span>

                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(item.status)}`}>
                            {item.status}
                          </span>

                          {/* Quick relocate selector */}
                          <select
                            value={item.location}
                            onChange={(e) => onUpdateItemLocation(item.id, e.target.value)}
                            className="text-[10px] border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            {locations.map(loc => (
                              <option key={loc} value={loc}>ย้ายไป {loc}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}

                  {itemsByLocation(selectedLocation).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-8">ไม่มีข้อมูลอุปกรณ์ในสถานที่นี้</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-96 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-white shadow-inner">
              <span className="material-symbols-outlined text-4xl text-blue-400 animate-bounce">location_on</span>
              <h4 className="font-bold text-slate-700 mt-4 text-sm">คลิกเลือกสถานที่สำนักงานด้านซ้าย</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                ระบบจะตรวจสอบและลิสต์รายการสิ่งของทั้งหมดที่ลงทะเบียนผูกไว้กับแผนกหรือสถานที่นั้นๆ เพื่ออำนวยความสะดวกในการจัดสรรทรัพย์สิน
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
