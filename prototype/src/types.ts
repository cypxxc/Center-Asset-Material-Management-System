export interface ActivityLog {
  id: string;
  itemId: string;
  itemName: string;
  action: string; // e.g., "Created", "Updated", "Audited", "Changed Custodian", "Status Change"
  details: string;
  user: string;
  timestamp: string; // ISO string
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'Asset' | 'Supply';
  category: string;
  qty: number;
  location: string;
  custodian: string;
  custodianInitial: string;
  status: 'ACTIVE' | 'IN STOCK' | 'DAMAGED' | 'BORROWED' | 'RETIRED';
  serialNumber: string;
  lastAudited: string; // YYYY-MM-DD
  image: string;
  description: string;
  notes?: string;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export type ActiveTab = 'Overview' | 'Assets' | 'Supplies' | 'Locations' | 'Reports' | 'Archive' | 'Trash';
