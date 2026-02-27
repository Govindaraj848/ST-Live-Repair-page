
import * as React from 'react';
import { ArrowLeft, RefreshCw, Download, Loader2, Filter, ChevronDown, Check, Search, X, Layers, Hash, Clock, FileText, Table } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchReportData, fetchInventoryData } from '../services/api';
import { ReportItem, InventoryItem } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Robustly parse dates from spreadsheet strings like "19/01/2026, 15:46:22"
 */
const parseFlexibleDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);
    const timeParts = dateStr.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
    if (timeParts) return new Date(year, month, day, parseInt(timeParts[1]), parseInt(timeParts[2]), parseInt(timeParts[3]));
    return new Date(year, month, day);
  }
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const mmmParts = dateStr.match(/(\d{1,2})[\-\/\s]([a-zA-Z]{3})[\-\/\s](\d{4})/);
  if (mmmParts) {
    const day = parseInt(mmmParts[1], 10);
    const month = monthMap[mmmParts[2].toLowerCase()];
    const year = parseInt(mmmParts[3], 10);
    if (month !== undefined) return new Date(year, month, day);
  }
  return null;
};

export const DataSetPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = React.useState<ReportItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [selectedMoves, setSelectedMoves] = React.useState<string[]>([]);
  const [selectedTranNo, setSelectedTranNo] = React.useState('');
  const [selectedBatchNo, setSelectedBatchNo] = React.useState('');
  const [selectedBrand, setSelectedBrand] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [startTime, setStartTime] = React.useState('');
  const [endTime, setEndTime] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const filterRef = React.useRef<HTMLDivElement>(null);
  const [isExportOpen, setIsExportOpen] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const currentUser = sessionStorage.getItem('inv_userName') || '';

  const loadData = async () => {
    setLoading(true);
    try {
        const [reportItems, inventoryItems] = await Promise.all([
          fetchReportData(),
          fetchInventoryData()
        ]);
        const invMap = new Map<string, InventoryItem>();
        inventoryItems.forEach(i => invMap.set(`${i.barcodeValue}_${i.tranNo}`, i));
        
        if (currentUser) {
            const enrichedData = reportItems
              .filter(item => item.user && item.user.trim().toLowerCase() === currentUser.trim().toLowerCase())
              .map(item => {
                  const inv = invMap.get(`${item.barcode}_${item.tranNo}`);
                  return {
                      ...item,
                      style: inv?.style || item.style || 'NA',
                      color: inv?.color || item.color || 'NA',
                      polish: inv?.polish || item.polish || 'NA',
                      size: inv?.size || item.size || 'NA',
                      brand: inv?.brand || item.brand || 'NA',
                      dummy7: inv?.dummy7 || item.dummy7 || 'NA',
                      dummy8: inv?.dummy8 || item.dummy8 || 'NA',
                  };
              });
            setData(enrichedData);
        } else setData([]);
    } catch (error) { console.error("Failed to load dataset", error); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { loadData(); }, [currentUser]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) setIsFilterOpen(false);
      if (exportRef.current && !exportRef.current.contains(target)) setIsExportOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterRef, exportRef]);

  const uniqueMoves = React.useMemo(() => Array.from(new Set(data.map(item => item.move).filter(Boolean) as string[])).sort(), [data]);
  const uniqueBrands = React.useMemo(() => Array.from(new Set(data.map(item => item.brand).filter(Boolean) as string[])).sort(), [data]);
  const uniqueBatchNos = React.useMemo(() => {
    return Array.from(new Set(data.map(item => item.batchNo).filter(Boolean) as string[])).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [data]);

  const uniqueTranNos = React.useMemo(() => {
      let filteredContext = data;
      if (selectedMoves.length > 0) filteredContext = filteredContext.filter(item => selectedMoves.includes(item.move));
      if (selectedBrand) filteredContext = filteredContext.filter(item => item.brand === selectedBrand);
      if (selectedBatchNo) filteredContext = filteredContext.filter(item => item.batchNo === selectedBatchNo);
      if (startDate || endDate) {
          let start: Date | null = null, end: Date | null = null;
          if (startDate) {
              const [y, m, d] = startDate.split('-').map(Number);
              start = new Date(y, m - 1, d);
              if (startTime) { const [h, min] = startTime.split(':').map(Number); start.setHours(h, min, 0, 0); }
              else start.setHours(0, 0, 0, 0);
          }
          if (endDate) {
              const [y, m, d] = endDate.split('-').map(Number);
              end = new Date(y, m - 1, d);
              if (endTime) { const [h, min] = endTime.split(':').map(Number); end.setHours(h, min, 59, 999); }
              else end.setHours(23, 59, 59, 999);
          }
          filteredContext = filteredContext.filter(item => {
              const itemDate = parseFlexibleDate(item.timestamp);
              if (!itemDate || isNaN(itemDate.getTime())) return false;
              if (start && itemDate < start) return false;
              if (end && itemDate > end) return false;
              return true;
          });
      }
      return Array.from(new Set(filteredContext.map(item => item.tranNo).filter(Boolean) as string[])).sort();
  }, [data, selectedMoves, selectedBrand, selectedBatchNo, startDate, endDate, startTime, endTime]);

  const visibleData = React.useMemo(() => {
      let filtered = data;
      if (selectedTranNo) filtered = filtered.filter(item => item.tranNo === selectedTranNo);
      if (selectedBatchNo) filtered = filtered.filter(item => item.batchNo === selectedBatchNo);
      if (selectedBrand) filtered = filtered.filter(item => item.brand === selectedBrand);
      if (selectedMoves.length > 0) filtered = filtered.filter(item => selectedMoves.includes(item.move));
      if (startDate || endDate) {
          let start: Date | null = null, end: Date | null = null;
          if (startDate) {
              const [y, m, d] = startDate.split('-').map(Number);
              start = new Date(y, m - 1, d);
              if (startTime) { const [h, min] = startTime.split(':').map(Number); start.setHours(h, min, 0, 0); }
              else start.setHours(0, 0, 0, 0);
          }
          if (endDate) {
              const [y, m, d] = endDate.split('-').map(Number);
              end = new Date(y, m - 1, d);
              if (endTime) { const [h, min] = endTime.split(':').map(Number); end.setHours(h, min, 59, 999); }
              else end.setHours(23, 59, 59, 999);
          }
          filtered = filtered.filter(item => {
              const itemDate = parseFlexibleDate(item.timestamp);
              if (!itemDate || isNaN(itemDate.getTime())) return false;
              if (start && itemDate < start) return false;
              if (end && itemDate > end) return false;
              return true;
          });
      }
      if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(query)));
      }

      // SORT BY DATE TIME (CHRONOLOGICAL SMALL TO LARGE)
      return [...filtered].sort((a, b) => {
          const dateA = parseFlexibleDate(a.timestamp)?.getTime() || 0;
          const dateB = parseFlexibleDate(b.timestamp)?.getTime() || 0;
          if (dateA !== dateB) return dateA - dateB;

          const serialA = parseInt(a.serialNo) || 0;
          const serialB = parseInt(b.serialNo) || 0;
          return serialA - serialB;
      });
  }, [data, selectedMoves, selectedTranNo, selectedBatchNo, selectedBrand, startDate, endDate, startTime, endTime, searchQuery]);

  // MOVE SUMMARY CALCULATION
  const moveSummary = React.useMemo(() => {
      const summary: Record<string, number> = {};
      visibleData.forEach(item => {
          const move = item.move || 'N/A';
          const qty = parseInt(item.qty, 10) || 0;
          summary[move] = (summary[move] || 0) + qty;
      });
      return Object.entries(summary).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleData]);

  const toggleMove = (move: string) => setSelectedMoves(prev => prev.includes(move) ? prev.filter(m => m !== move) : [...prev, move]);
  const handleSelectAll = () => setSelectedMoves(uniqueMoves);
  const handleClearMoves = () => setSelectedMoves([]);

  const handleBarcodeExport = () => {
    const aggregationMap = new Map<string, number>();
    visibleData.forEach(item => {
        const key = item.barcode, qty = parseInt(item.qty, 10) || 0;
        aggregationMap.set(key, (aggregationMap.get(key) || 0) + qty);
    });
    const isOnlySelectedMove = selectedMoves.length === 1 && selectedMoves[0] === 'Selected';
    const headers = isOnlySelectedMove ? ["Barcode", "Qty"] : ["Barcode", "Qty", "Barcode39"];
    
    const csvContent = [ 
      headers.join(","), 
      ...Array.from(aggregationMap.entries()).map(([barcode, qty]) => {
        if (isOnlySelectedMove) {
            return [`="${barcode}"`, `"${qty}"`].join(",");
        } else {
            return [`="${barcode}"`, `"${qty}"`, `"*${barcode}*"`].join(",");
        }
      }) 
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.setAttribute('href', url);
    if (selectedTranNo) link.setAttribute('download', `DataSet_${currentUser}_${selectedTranNo}.csv`);
    else link.setAttribute('download', `DataSet_Report_${currentUser}_${startDate || new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFullExport = () => {
    const headers = ["Date Time", "Design No", "Item Name", "Barcode", "ST No", "Qty", "Move", "Batch No", "Serial No", "User", "Discount", "Style", "Color", "Polish", "Size", "Brand", "Dummy7", "Dummy8"];
    const csvContent = [ headers.join(","), ...visibleData.map(item => [`"${item.timestamp}"`, `"${item.designNo}"`, `"${item.itemName}"`, `"='${item.barcode}"`, `"${item.tranNo}"`, `"${item.qty}"`, `"${item.move}"`, `"${item.batchNo}"`, `"${item.serialNo}"`, `"${item.user}"`, `"${item.discount}"`, `"${item.style}"`, `"${item.color}"`, `"${item.polish}"`, `"${item.size}"`, `"${item.brand}"`, `"${item.dummy7}"`, `"${item.dummy8}"`].join(",")) ].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DataSet_Full_${currentUser}_${startDate || new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handlePDFExport = () => {
    const doc = new jsPDF();
    const totalQty = visibleData.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
    
    doc.setFontSize(18); 
    doc.text("ST Repair Sheet (History)", 14, 20); 
    
    doc.setFontSize(11); 
    doc.setTextColor(0); 
    doc.text(`Total Qty: ${totalQty}`, 14, 28);
    
    doc.setTextColor(100);
    doc.text(`User: ${currentUser} | ST: ${selectedTranNo || 'All'} | Brand: ${selectedBrand || 'All'} | Moves: ${selectedMoves.length > 0 ? selectedMoves.join(', ') : 'All'}`, 14, 34);
    
    const tableColumn = ["SL NO", "ST NO", "Design No", "Item Name", "Barcode", "Qty", "Discount"];
    const tableRows = visibleData.map(item => {
        let discDisplay = item.discount || '0';
        if (discDisplay.trim() === '0' || discDisplay.trim() === '0%') {
            discDisplay = 'No offer';
        }
        return [
            item.serialNo,
            item.tranNo, 
            item.designNo, 
            item.itemName,
            item.barcode, 
            item.qty, 
            discDisplay
        ];
    });
    
    autoTable(doc, { 
      head: [tableColumn], 
      body: tableRows, 
      startY: 40, 
      theme: 'grid', 
      headStyles: { fillColor: [26, 75, 140] },
      styles: { fontSize: 8 } // Slightly smaller font to accommodate "Item Name" column
    });
    
    doc.save(`DataSet_Report_${currentUser}_${startDate || new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col p-4">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-6">
         <div className="flex items-center w-full md:w-auto">
            <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-[#1a4b8c] font-bold mr-4">
                <ArrowLeft className="w-5 h-5 mr-1" /> Back
            </button>
            <div>
                <h1 className="text-2xl font-bold text-[#1a4b8c]">Data Set (Permanent)</h1>
                {currentUser ? <p className="text-sm text-gray-600">Viewing: <span className="font-bold text-black">{currentUser}</span></p> : <p className="text-sm text-red-500 font-bold">No User Selected</p>}
            </div>
         </div>
         <div className="flex flex-wrap gap-6 items-center z-20 justify-end w-full md:w-auto">
             <div className="relative h-10 w-full md:w-64">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Search className="w-4 h-4 text-gray-500" /></div>
                <input type="text" className="block w-full h-full pl-10 pr-8 py-2 border border-gray-300 rounded bg-white text-sm" placeholder="Search all..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                 {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-2"><X className="w-4 h-4 text-gray-400" /></button>}
             </div>
             <div className="w-40 h-10 relative bg-white border border-gray-300 rounded shadow-sm">
                 <SearchableSelect options={uniqueBrands} value={selectedBrand} onChange={setSelectedBrand} placeholder="Brand" />
             </div>
             <div className="w-40 h-10 relative bg-white border border-gray-300 rounded shadow-sm">
                 <SearchableSelect options={uniqueBatchNos} value={selectedBatchNo} onChange={setSelectedBatchNo} placeholder="Batch No" />
             </div>
             <div className="w-40 h-10 relative bg-white border border-gray-300 rounded shadow-sm">
                 <SearchableSelect options={uniqueTranNos} value={selectedTranNo} onChange={setSelectedTranNo} placeholder="ST No" />
             </div>
             <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} className="h-10" />
             <div className="flex items-center bg-white border border-gray-300 rounded shadow-sm px-2 h-10 gap-4 min-w-[200px]">
                <Clock className="w-4 h-4 text-gray-500" /><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs w-20" /><span className="text-gray-400">-</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-xs w-20" />
             </div>
             <div className="relative" ref={filterRef}>
                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex items-center bg-white border border-gray-300 rounded shadow-sm px-3 h-10 text-sm justify-between min-w-[140px]">
                    <Filter className="w-4 h-4 text-gray-500 mr-2" /><span>{selectedMoves.length === 0 ? "All Moves" : `${selectedMoves.length} Selected`}</span><ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {isFilterOpen && (
                    <div className="absolute top-full right-0 w-56 bg-white border rounded shadow-lg z-30 flex flex-col">
                        <div className="p-2 border-b bg-gray-50 flex justify-between text-xs font-bold uppercase text-gray-500">
                            <span>Select Moves</span>
                            <div className="flex gap-2">
                                <button onClick={handleSelectAll} className="text-blue-600">All</button>
                                <button onClick={handleClearMoves} className="text-red-600">Clear</button>
                            </div>
                        </div>
                        <div className="p-1 max-h-60 overflow-y-auto">
                            {uniqueMoves.map(move => {
                                const isSelected = selectedMoves.includes(move);
                                return (
                                    <div key={move} onClick={() => toggleMove(move)} className={`flex items-center px-3 py-2 cursor-pointer hover:bg-blue-50 rounded text-sm ${isSelected ? 'bg-blue-50 font-medium' : ''}`}>
                                        <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        {move}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
             </div>
             <button onClick={loadData} disabled={loading} className="bg-blue-600 text-white px-4 h-10 rounded shadow flex items-center gap-2 font-medium disabled:bg-blue-300"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
             <div className="relative h-10" ref={exportRef}>
                <button onClick={() => setIsExportOpen(!isExportOpen)} disabled={loading || !visibleData.length} className="bg-green-600 text-white px-4 h-full rounded shadow flex items-center gap-2 font-medium disabled:bg-green-300">Export <ChevronDown className="w-4 h-4" /></button>
                {isExportOpen && (
                    <div className="absolute top-full right-0 w-48 bg-white border rounded shadow-lg flex flex-col z-30 text-sm">
                        <button 
                            onClick={() => { handleBarcodeExport(); setIsExportOpen(false); }} 
                            disabled={selectedMoves.length === 0}
                            className="p-3 hover:bg-gray-50 text-left flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                        >
                            <Download className="w-4 h-4" /> Barcode Summary
                        </button>
                        <button onClick={() => { handleFullExport(); setIsExportOpen(false); }} className="p-3 hover:bg-gray-50 text-left border-t flex items-center gap-2 w-full"><Table className="w-4 h-4" /> Full Data CSV</button>
                        <button 
                            onClick={() => { handlePDFExport(); setIsExportOpen(false); }} 
                            disabled={selectedMoves.length === 0}
                            className="p-3 hover:bg-gray-50 text-left border-t flex items-center gap-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileText className="w-4 h-4" /> PDF Report
                        </button>
                    </div>
                )}
             </div>
         </div>
      </div>

      {/* Move Summary Table */}
      {!loading && visibleData.length > 0 && (
          <div className="mb-6 flex flex-col md:flex-row gap-4 items-start">
              <div className="bg-white shadow-md border border-gray-400 rounded overflow-hidden w-full md:w-auto min-w-[320px]">
                  <div className="bg-[#1a4b8c] text-white px-4 py-2 font-bold text-sm uppercase flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Move Summary
                  </div>
                  <table className="w-full text-sm border-collapse">
                      <thead>
                          <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
                              <th className="p-2 text-left border-r border-gray-300">Move Type</th>
                              <th className="p-2 text-center">Total Qty</th>
                          </tr>
                      </thead>
                      <tbody>
                          {moveSummary.map(([move, totalQty]) => (
                              <tr key={move} className="border-b border-gray-200 hover:bg-gray-50">
                                  <td className="p-2 text-left font-semibold text-[#1a4b8c] border-r border-gray-300">{move}</td>
                                  <td className="p-2 text-center font-bold text-lg">{totalQty}</td>
                              </tr>
                          ))}
                          <tr className="bg-blue-50 font-bold">
                              <td className="p-2 text-left border-r border-gray-300 uppercase">Grand Total</td>
                              <td className="p-2 text-center text-blue-700 text-lg">
                                  {moveSummary.reduce((sum, curr) => sum + curr[1], 0)}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      <div className="bg-white shadow-lg border border-gray-400 overflow-x-auto min-h-[500px]">
         {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div> : visibleData.length ? (
             <table className="w-full text-sm text-center border-collapse">
                <thead>
                   <tr className="bg-[#ffff00] text-[#ff0000] font-bold uppercase text-xs">
                      <th className="p-2 border border-gray-400 bg-black text-white">Date Time</th>
                      <th className="p-2 border border-gray-400">Desig no</th>
                      <th className="p-2 border border-gray-400">Item Name</th>
                      <th className="p-2 border border-gray-400">Barcode</th>
                      <th className="p-2 border border-gray-400">ST No</th>
                      <th className="p-2 border border-gray-400">Qty</th>
                      <th className="p-2 border border-gray-400">MOVE</th>
                      <th className="p-2 border border-gray-400 text-blue-800">Batch No</th>
                      <th className="p-2 border border-gray-400">Serial No</th>
                      <th className="p-2 border border-gray-400">User</th>
                      <th className="p-2 border border-gray-400">Discount</th>
                      <th className="p-2 border border-gray-400">STYLE</th>
                      <th className="p-2 border border-gray-400">COLOR</th>
                      <th className="p-2 border border-gray-400">POLISH</th>
                      <th className="p-2 border border-gray-400">SIZE</th>
                      <th className="p-2 border border-gray-400">BRAND</th>
                      <th className="p-2 border border-gray-400">DUMMY7</th>
                      <th className="p-2 border border-gray-400">DUMMY8</th>
                   </tr>
                </thead>
                <tbody className="bg-white">
                  {visibleData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 border-b border-gray-200">
                      <td className="p-2 border border-gray-300 whitespace-nowrap font-bold text-[#1a4b8c] bg-yellow-50">{row.timestamp}</td>
                      <td className="p-2 border border-gray-300 font-bold">{row.designNo}</td>
                      <td className="p-2 border border-gray-300">{row.itemName}</td>
                      <td className="p-2 border border-gray-300 text-left pl-4 relative">
                          <div className="absolute top-0 left-0 w-0 h-0 border-t-[6px] border-t-green-600 border-r-[6px] border-r-transparent"></div>
                          {row.barcode}
                      </td>
                      <td className="p-2 border border-gray-300">{row.tranNo}</td>
                      <td className="p-2 border border-gray-300 font-bold">{row.qty}</td>
                      <td className="p-2 border border-gray-300 font-semibold">{row.move}</td>
                      <td className="p-2 border border-gray-300 text-blue-600 font-bold">
                          {row.batchNo ? <span className="flex items-center justify-center gap-1"><Hash className="w-3 h-3"/>{row.batchNo}</span> : '-'}
                      </td>
                      <td className="p-2 border border-gray-300 font-extrabold text-[#1a4b8c] text-base">
                          {row.serialNo}
                      </td>
                      <td className="p-2 border border-gray-300">{row.user}</td>
                      <td className="p-2 border border-gray-300">{row.discount}</td>
                      <td className="p-2 border border-gray-300">{row.style}</td>
                      <td className="p-2 border border-gray-300 font-medium">{row.color}</td>
                      <td className="p-2 border border-gray-300">{row.polish}</td>
                      <td className="p-2 border border-gray-300">{row.size}</td>
                      <td className="p-2 border border-gray-300">{row.brand}</td>
                      <td className="p-2 border border-gray-300">{row.dummy7}</td>
                      <td className="p-2 border border-gray-300">{row.dummy8}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
         ) : <div className="p-8 text-center text-gray-500">No data found.</div>}
      </div>
    </div>
  );
};
