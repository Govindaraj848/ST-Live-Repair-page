
export interface InventoryItem {
  designNo: string;
  itemName: string;
  style: string;
  color: string;
  polish: string;
  size: string;
  brand: string;
  userName: string;
  dummy7: string;
  dummy8: string;
  combId: string;
  tranDate: string;
  tranNo: string;
  barcodeValue: string;
  currentStk: number;
  discount: string;
}

export interface GalleryItem {
  designNo: string;
  imageUrl: string;
  category: string;
}

export interface ReportItem {
  timestamp: string;
  designNo: string;
  itemName: string;
  barcode: string;
  tranNo: string;
  qty: string;
  move: string;
  user: string;
  serialNo: string;
  discount: string;
  // Optional enriched fields
  style?: string;
  color?: string;
  polish?: string;
  size?: string;
  brand?: string;
  dummy7?: string;
  dummy8?: string;
  // New field for tracking export status
  exportStatus?: string;
  // Batch number for export grouping
  batchNo?: string;
}
