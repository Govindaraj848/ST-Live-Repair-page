
import * as React from 'react';
import { ArrowLeft, RefreshCw, Download, Loader2, Filter, ChevronDown, Check, Search, X, Layers, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchReportData, fetchInventoryData, markItemsAsExported } from '../services/api';
import { ReportItem, InventoryItem } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { DateRangePicker } from '../components/DateRangePicker';

/**
 * Robustly parse dates from spreadsheet strings like "19/01/2026, 15:46:22"
 * handles DD/MM/YYYY, DD-MM-YYYY, and DD-MMM-YYYY.
 */
const parseFlexibleDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // Try native parsing first
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);
    
    // Check for time HH:MM:SS
    const timeParts = dateStr.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
    if (timeParts) {
      return new Date(year, month, day, parseInt(timeParts[1]), parseInt(timeParts[2]), parseInt(timeParts[3]));
    }
    return new Date(year, month, day);
  }

  // Handle DD-MMM-YYYY (e.g. 19-Jan-2026)
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

export const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = React.useState<ReportItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [selectedMoves, setSelectedMoves] = React.useState<string[]>([]);
  const [selectedTranNo, setSelectedTranNo] = React.useState('');
  const [selectedBatchNo, setSelectedBatchNo] = React.useState('');
  const [selectedBrand, setSelectedBrand] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sessionExports, setSessionExports] = React.useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const filterRef = React.useRef<HTMLDivElement>(null);
  const [isExportOpen, setIsExportOpen] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  
  const currentUser = sessionStorage.getItem('inv_userName') || '';

  const getCompositeId = (item: ReportItem) => {
      if (item.serialNo && item.serialNo.trim() !== '' && item.tranNo) {
          return `S_${item.tranNo.trim()}_${item.serialNo.trim()}`;
      }
      return `T_${item.timestamp.trim()}_${item.barcode.trim()}_${item.tranNo.trim()}_${item.move.trim()}_${item.qty.trim()}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
        const [reportItems, inventoryItems] = await Promise.all([
          fetchReportData(),
          fetchInventoryData()
        ]);
        
        const invMap = new Map<string, InventoryItem>();
        inventoryItems.forEach(i => {
           invMap.set(`${i.barcodeValue}_${i.tranNo}`, i);
        });

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
        } else {
            setData([]);
        }
    } catch (error) {
        console.error("Failed to load report", error);
    } finally {
        setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [currentUser]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) setIsFilterOpen(false);
      if (exportRef.current && !exportRef.current.contains(target)) setIsExportOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterRef, exportRef]);

  const unexportedData = React.useMemo(() => {
      return data.filter(item => {
          const cid = getCompositeId(item);
          const isHiddenLocally = sessionExports.has(cid);
          const status = (item.exportStatus || 'NO').trim().toUpperCase();
          const isServerEligible = status !== 'YES';
          return !isHiddenLocally && isServerEligible;
      });
  }, [data, sessionExports]);

  const uniqueMoves = React.useMemo(() => {
      const moves = new Set(unexportedData.map(item => item.move).filter(Boolean));
      return Array.from(moves).sort();
  }, [unexportedData]);

  const uniqueBrands = React.useMemo(() => {
      const brands = new Set(unexportedData.map(item => item.brand).filter(Boolean));
      return Array.from(brands).sort();
  }, [unexportedData]);

  const uniqueBatchNos = React.useMemo(() => {
      // Fix: cast to string[] to resolve 'unknown' inference issue in sort and parseInt
      const batches = new Set(unexportedData.map(item => item.batchNo).filter(Boolean) as string[]);
      return Array.from(batches).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [unexportedData]);

  const uniqueTranNos = React.useMemo(() => {
      let filteredContext = unexportedData;

      if (selectedMoves.length > 0) {
          filteredContext = filteredContext.filter(item => selectedMoves.includes(item.move));
      }

      if (selectedBrand) {
          filteredContext = filteredContext.filter(item => item.brand === selectedBrand);
      }

      if (selectedBatchNo) {
          filteredContext = filteredContext.filter(item => item.batchNo === selectedBatchNo);
      }

      if (startDate || endDate) {
          const start = startDate ? new Date(startDate) : null;
          if (start) start.setHours(0, 0, 0, 0);
          const end = endDate ? new Date(endDate) : null;
          if (end) end.setHours(23, 59, 59, 999);

          filteredContext = filteredContext.filter(item => {
              if (!item.timestamp) return false;
              const itemDate = parseFlexibleDate(item.timestamp);
              if (!itemDate || isNaN(itemDate.getTime())) return false;
              if (start && itemDate < start) return false;
              if (end && itemDate > end) return false;
              return true;
          });
      }

      const trans = new Set(filteredContext.map(item => item.tranNo).filter(Boolean));
      return Array.from(trans).sort();
  }, [unexportedData, selectedMoves, selectedBrand, selectedBatchNo, startDate, endDate]);

  const visibleData = React.useMemo(() => {
      let filtered = unexportedData;

      if (selectedTranNo) {
          filtered = filtered.filter(item => item.tranNo === selectedTranNo);
      }

      if (selectedBatchNo) {
          filtered = filtered.filter(item => item.batchNo === selectedBatchNo);
      }

      if (selectedBrand) {
          filtered = filtered.filter(item => item.brand === selectedBrand);
      }

      if (selectedMoves.length > 0) {
          filtered = filtered.filter(item => selectedMoves.includes(item.move));
      }

      if (startDate || endDate) {
          const start = startDate ? new Date(startDate) : null;
          if (start) start.setHours(0, 0, 0, 0);
          const end = endDate ? new Date(endDate) : null;
          if (end) end.setHours(23, 59, 59, 999);

          filtered = filtered.filter(item => {
              if (!item.timestamp) return false;
              const itemDate = parseFlexibleDate(item.timestamp);
              if (!itemDate || isNaN(itemDate.getTime())) return false;
              if (start && itemDate < start) return false;
              if (end && itemDate > end) return false;
              return true;
          });
      }

      if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(item => 
             Object.values(item).some(val => 
                 String(val).toLowerCase().includes(query)
             )
          );
      }

      // SORT BY DATE TIME (CHRONOLOGICAL SMALL TO LARGE)
      return [...filtered].sort((a, b) => {
          const dateA = parseFlexibleDate(a.timestamp)?.getTime() || 0;
          const dateB = parseFlexibleDate(b.timestamp)?.getTime() || 0;
          if (dateA !== dateB) return dateA - dateB;
          
          // Secondary sort by Serial No
          const serialA = parseInt(a.serialNo) || 0;
          const serialB = parseInt(b.serialNo) || 0;
          return serialA - serialB;
      });
  }, [unexportedData, selectedMoves, selectedTranNo, selectedBatchNo, selectedBrand, startDate, endDate, searchQuery]);

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

  const toggleMove = (move: string) => {
    setSelectedMoves(prev => prev.includes(move) ? prev.filter(m => m !== move) : [...prev, move]);
  };

  const handleSelectAll = () => setSelectedMoves(uniqueMoves);
  const handleClearMoves = () => setSelectedMoves([]);

  const markAsExported = async (itemsToMark: ReportItem[], batchNo: string = '') => {
      const newSet = new Set(sessionExports);
      itemsToMark.forEach(item => newSet.add(getCompositeId(item)));
      setSessionExports(newSet);
      try {
          await markItemsAsExported(itemsToMark, batchNo);
      } catch (e) {
          console.error("Background sync of export status failed", e);
      }
  };

  const handleBarcodeExport = async () => {
    const dataToExport = [...visibleData];
    if (dataToExport.length === 0) return;

    const maxBatch = data.reduce((max, item) => {
        const b = parseInt(item.batchNo || '0', 10);
        return isNaN(b) ? max : Math.max(max, b);
    }, 0);
    const newBatchNo = String(maxBatch + 1);

    const aggregationMap = new Map<string, number>();
    dataToExport.forEach(item => {
        const key = item.barcode;
        const qty = parseInt(item.qty, 10) || 0;
        aggregationMap.set(key, (aggregationMap.get(key) || 0) + qty);
    });

    const isOnlySelectedMove = selectedMoves.length === 1 && selectedMoves[0] === 'Selected';
    // REMOVED Batch No from headers
    const headers = isOnlySelectedMove ? ["Barcode", "Qty"] : ["Barcode", "Qty", "Barcode39"];
    
    const csvContent = [
        headers.join(","),
        ...Array.from(aggregationMap.entries()).map(([barcode, qty]) => {
            if (isOnlySelectedMove) {
                return [`="${barcode}"`, `"${qty}"`].join(",");
            } else {
                const barcode39 = `*${barcode}*`;
                return [`="${barcode}"`, `"${qty}"`, `"${barcode39}"`].join(",");
            }
        })
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    if (selectedTranNo) link.setAttribute('download', `${currentUser}_${selectedTranNo}_Batch_${newBatchNo}.csv`);
    else {
        const dateSuffix = startDate || new Date().toISOString().slice(0,10);
        const filterSuffix = selectedMoves.length === uniqueMoves.length ? '_All' : `_${selectedMoves.length}-moves`;
        link.setAttribute('download', `Inventory_Report_${currentUser}${filterSuffix}_${dateSuffix}_Batch_${newBatchNo}.csv`);
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    sessionStorage.removeItem('inv_lastSavedSerial');
    await markAsExported(dataToExport, newBatchNo);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col p-4">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-6">
         <div className="flex items-center w-full md:w-auto">
            <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-[#1a4b8c] font-bold mr-4 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-1" /> Back
            </button>
            <div>
                <h1 className="text-2xl font-bold text-[#1a4b8c]">Report Page (Unexported)</h1>
                {currentUser ? (
                    <p className="text-sm text-gray-600">Viewing fresh data for: <span className="font-bold text-black">{currentUser}</span></p>
                ) : (
                    <p className="text-sm text-red-500 font-bold">No User Selected</p>
                )}
            </div>
         </div>

         <div className="flex flex-wrap gap-6 items-center z-20 justify-end w-full md:w-auto">
             <div className="relative h-10 w-full md:w-64">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-500" />
                </div>
                <input type="text" className="block w-full h-full pl-10 pr-8 py-2 border border-gray-300 rounded-md bg-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="Search all..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                 {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
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
             <div className="relative" ref={filterRef}>
                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="flex items-center bg-white border border-gray-300 rounded shadow-sm px-3 py-2 text-sm font-medium hover:bg-gray-50 min-w-[140px] justify-between h-10">
                    <Filter className="w-4 h-4 text-gray-500 mr-2" />
                    <span>{selectedMoves.length === 0 ? "All Moves" : `${selectedMoves.length} Selected`}</span>
                    <ChevronDown className="w-4 h-4 ml-2 text-gray-400" />
                </button>
                {isFilterOpen && (
                    <div className="absolute top-full mt-1 right-0 w-56 bg-white border border-gray-200 rounded-md shadow-lg flex flex-col z-30">
                        <div className="p-2 border-b bg-gray-50 flex justify-between items-center text-xs font-bold uppercase text-gray-500">
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
             <button onClick={loadData} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 font-medium disabled:bg-blue-300 h-10">
                 <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
             </button>
             <div className="relative h-10" ref={exportRef}>
                <button onClick={() => setIsExportOpen(!isExportOpen)} disabled={loading || visibleData.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 font-medium disabled:bg-green-300 h-full">
                    <Download className="w-4 h-4" /> Export <ChevronDown className="w-4 h-4 ml-1" />
                </button>
                {isExportOpen && (
                    <div className="absolute top-full mt-1 right-0 w-48 bg-white border border-gray-200 rounded-md shadow-lg flex flex-col z-30">
                        <button 
                            onClick={() => { handleBarcodeExport(); setIsExportOpen(false); }} 
                            disabled={selectedMoves.length === 0} 
                            className="text-left px-4 py-3 hover:bg-gray-50 text-sm w-full flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" /> Barcode Summary
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
         {loading ? (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600 font-medium">Loading...</span>
             </div>
         ) : !currentUser ? (
             <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
                <p className="text-red-500 font-bold text-lg mb-2">Access Restricted</p>
                <button onClick={() => navigate('/')} className="bg-[#1a4b8c] text-white px-4 py-2 rounded shadow">Home</button>
             </div>
         ) : visibleData.length === 0 ? (
             <div className="p-8 text-center text-gray-500">No records match criteria.</div>
         ) : (
             <table className="w-full text-sm text-center border-collapse">
                <thead>
                   <tr className="bg-[#ffff00] text-[#ff0000] font-bold uppercase text-xs md:text-sm">
                      <th className="p-2 border border-gray-400 bg-black text-white">Date Time</th>
                      <th className="p-2 border border-gray-400">Desig no</th>
                      <th className="p-2 border border-gray-400">Item Name</th>
                      <th className="p-2 border border-gray-400">Barcode</th>
                      <th className="p-2 border border-gray-400">ST No</th>
                      <th className="p-2 border border-gray-400">Qty</th>
                      <th className="p-2 border border-gray-400">MOVE</th>
                      <th className="p-2 border border-gray-400 text-blue-800">Batch No</th>
                      <th className="p-2 border border-gray-400 text-blue-600">Serial No</th>
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
                <tbody className="bg-white text-gray-800">
                   {visibleData.map((row, index) => (
                       <tr key={index} className="hover:bg-gray-50 border-b border-gray-200">
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
         )}
      </div>
    </div>
  );
};
