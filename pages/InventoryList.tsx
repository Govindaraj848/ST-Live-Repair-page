
import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SyncBanner } from '../components/SyncBanner';
import { Loader2, RefreshCw, Upload, CheckSquare, Square, Layers, X, CheckCircle, Search, Eye } from 'lucide-react';
import { fetchInventoryData, fetchUserNames, parseCSVData, fetchReportData } from '../services/api';
import { InventoryItem } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { IMAGE_BASE_URL } from '../constants';

export const InventoryList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [inventory, setInventory] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // User Name Options from Google Sheet
  const [userOptions, setUserOptions] = React.useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);

  // File Input Ref for uploading AppSheet database manually
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filter States - Initialized from Session Storage
  const [selectedItemName, setSelectedItemName] = React.useState(() => sessionStorage.getItem('inv_itemName') || '');
  const [selectedTranNo, setSelectedTranNo] = React.useState(() => sessionStorage.getItem('inv_tranNo') || '');
  const [selectedBrand, setSelectedBrand] = React.useState(() => sessionStorage.getItem('inv_brand') || '');
  const [selectedStyle, setSelectedStyle] = React.useState(() => sessionStorage.getItem('inv_style') || '');
  const [selectedColor, setSelectedColor] = React.useState(() => sessionStorage.getItem('inv_color') || '');
  const [selectedPolish, setSelectedPolish] = React.useState(() => sessionStorage.getItem('inv_polish') || '');
  const [selectedSize, setSelectedSize] = React.useState(() => sessionStorage.getItem('inv_size') || '');
  const [selectedDummy7, setSelectedDummy7] = React.useState(() => sessionStorage.getItem('inv_dummy7') || '');
  const [selectedDummy8, setSelectedDummy8] = React.useState(() => sessionStorage.getItem('inv_dummy8') || '');
  const [selectedUserName, setSelectedUserName] = React.useState(() => sessionStorage.getItem('inv_userName') || '');
  
  // Track ONLY the last clicked design for a single orange border
  const [lastVisitedDesign, setLastVisitedDesign] = React.useState<string | null>(() => {
    return sessionStorage.getItem('inv_lastVisitedDesign');
  });

  // Additional Search Query (Text Search)
  const [searchQuery, setSearchQuery] = React.useState('');

  // Selection State
  const [selectedDesigns, setSelectedDesigns] = React.useState<Set<string>>(new Set());

  // Popup State (Success notification after save)
  const [savedPopupItems, setSavedPopupItems] = React.useState<{designNo: string, tranNo: string, slNo: string, type?: 'current' | 'previous'}[]>([]);

  // Last Saved Serial No (for display)
  const [lastSavedSerial, setLastSavedSerial] = React.useState(() => sessionStorage.getItem('inv_lastSavedSerial') || '');

  React.useEffect(() => {
    sessionStorage.setItem('inv_itemName', selectedItemName);
    sessionStorage.setItem('inv_tranNo', selectedTranNo);
    sessionStorage.setItem('inv_brand', selectedBrand);
    sessionStorage.setItem('inv_style', selectedStyle);
    sessionStorage.setItem('inv_color', selectedColor);
    sessionStorage.setItem('inv_polish', selectedPolish);
    sessionStorage.setItem('inv_size', selectedSize);
    sessionStorage.setItem('inv_dummy7', selectedDummy7);
    sessionStorage.setItem('inv_dummy8', selectedDummy8);
    sessionStorage.setItem('inv_userName', selectedUserName);
    sessionStorage.setItem('inv_lastVisitedDesign', lastVisitedDesign || '');
  }, [selectedItemName, selectedTranNo, selectedBrand, selectedStyle, selectedColor, selectedPolish, selectedSize, selectedDummy7, selectedDummy8, selectedUserName, lastVisitedDesign]);

  // Check for popup data coming from ItemDetail (Success State)
  React.useEffect(() => {
    if (location.state && location.state.triggerPopup) {
      const justSaved = location.state.savedPopupItems || [];
      const displayItems: {designNo: string, tranNo: string, slNo: string, type?: 'current' | 'previous'}[] = [];

      try {
          const raw = sessionStorage.getItem('moved_items_cache');
          const cache = JSON.parse(raw || '[]');
          
          const cacheMap = new Map<string, any>();
          cache.forEach((item: any) => {
              if (item.serialNo) {
                  cacheMap.set(item.serialNo, item);
              }
          });

          justSaved.forEach((item: any) => {
              displayItems.push({ 
                  designNo: item.designNo,
                  tranNo: item.tranNo,
                  slNo: item.slNo,
                  type: 'current' 
              });

              const currentSl = parseInt(item.slNo);
              if (!isNaN(currentSl) && currentSl > 1) {
                  const prevSl = String(currentSl - 1);
                  const prevItem = cacheMap.get(prevSl);
                  if (prevItem) {
                      displayItems.push({
                          designNo: prevItem.designNo || 'N/A',
                          tranNo: prevItem.tranNo,
                          slNo: prevItem.serialNo,
                          type: 'previous'
                      });
                  }
              }
          });
      } catch (e) {
          console.error("Error processing history for popup", e);
          displayItems.push(...justSaved.map((i: any) => ({ ...i, type: 'current' })));
      }
      
      setSavedPopupItems(displayItems);
      // Clean history state
      window.history.replaceState({}, document.title);
      // Update last saved serial from session if available
      setLastSavedSerial(sessionStorage.getItem('inv_lastSavedSerial') || '');

      const timer = setTimeout(() => {
        setSavedPopupItems([]);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, reportData] = await Promise.all([
        fetchInventoryData(),
        fetchReportData()
      ]);

      const reportQtyMap = new Map<string, number>();
      
      const reportTimestamps = new Set(reportData.map(r => r.timestamp));

      reportData.forEach(r => {
        const key = `${r.barcode}_${r.tranNo}`;
        const q = parseInt(r.qty) || 0;
        reportQtyMap.set(key, (reportQtyMap.get(key) || 0) + q);
      });

      try {
        const localCacheRaw = sessionStorage.getItem('moved_items_cache');
        const localMoved = JSON.parse(localCacheRaw || '[]');
        
        if (Array.isArray(localMoved)) {
            localMoved.forEach((entry: any) => {
                if (entry && typeof entry === 'object' && entry.timestamp && reportTimestamps.has(entry.timestamp)) {
                    return;
                }
                if (typeof entry === 'string') {
                    reportQtyMap.set(entry, (reportQtyMap.get(entry) || 0) + 1);
                } else if (entry && typeof entry === 'object') {
                    const k = entry.key;
                    const q = entry.qty || 0;
                    reportQtyMap.set(k, (reportQtyMap.get(k) || 0) + q);
                }
            });
        }
      } catch (err) {
        console.error("Error reading moved_items_cache", err);
      }

      const activeInventory = data.reduce((acc, item) => {
        const key = `${item.barcodeValue}_${item.tranNo}`;
        const movedQty = reportQtyMap.get(key) || 0;
        
        if (movedQty > 0) {
            const remaining = item.currentStk - movedQty;
            if (remaining > 0) {
                acc.push({ ...item, currentStk: remaining });
                reportQtyMap.set(key, 0); 
            } else {
                reportQtyMap.set(key, movedQty - item.currentStk);
            }
        } else {
            acc.push(item);
        }
        return acc;
      }, [] as InventoryItem[]);

      setInventory(activeInventory);
    } catch (e) {
      console.error("Failed to load inventory", e);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
        const users = await fetchUserNames();
        setUserOptions(users);
    } catch (e) {
        console.error("Failed to load users", e);
    } finally {
        setLoadingUsers(false);
    }
  };

  React.useEffect(() => {
    loadData();
    loadUsers();
  }, []);

  const handleRefresh = async () => {
    setInventory([]);
    setLoading(true);
    // Clear filters logic...
    sessionStorage.removeItem('inv_itemName');
    sessionStorage.removeItem('inv_tranNo');
    sessionStorage.removeItem('inv_brand');
    sessionStorage.removeItem('inv_style');
    sessionStorage.removeItem('inv_color');
    sessionStorage.removeItem('inv_polish');
    sessionStorage.removeItem('inv_size');
    sessionStorage.removeItem('inv_dummy7');
    sessionStorage.removeItem('inv_dummy8');
    sessionStorage.removeItem('inv_userName');
    sessionStorage.removeItem('inv_lastSavedSerial');
    sessionStorage.removeItem('moved_items_cache');
    sessionStorage.removeItem('inv_lastVisitedDesign');

    setSelectedItemName('');
    setSelectedTranNo('');
    setSelectedBrand('');
    setSelectedStyle('');
    setSelectedColor('');
    setSelectedPolish('');
    setSelectedSize('');
    setSelectedDummy7('');
    setSelectedDummy8('');
    setSelectedUserName('');
    setSearchQuery('');
    setSelectedDesigns(new Set());
    setLastVisitedDesign(null);
    setLastSavedSerial(''); 
    
    try {
        await Promise.all([loadData(), loadUsers()]);
        alert("Data refreshed from Sheets");
    } catch(e) {
        console.error(e);
        alert("Failed to refresh data");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const data = parseCSVData(text);
          if (data.length > 0) {
             setInventory(data);
             alert(`Successfully uploaded ${data.length} items from AppSheet export.`);
          } else {
             alert("No valid data found in file.");
          }
        } catch (err) {
          console.error("CSV Parse Error", err);
          alert("Failed to parse CSV file.");
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const filteredInventory = React.useMemo(() => {
    return inventory.filter(item => {
      if (selectedItemName && item.itemName !== selectedItemName) return false;
      if (selectedTranNo && item.tranNo !== selectedTranNo) return false;
      if (selectedBrand && item.brand !== selectedBrand) return false;
      if (selectedStyle && item.style !== selectedStyle) return false;
      if (selectedColor && item.color !== selectedColor) return false;
      if (selectedPolish && item.polish !== selectedPolish) return false;
      if (selectedSize && item.size !== selectedSize) return false;
      if (selectedDummy7 && item.dummy7 !== selectedDummy7) return false;
      if (selectedDummy8 && item.dummy8 !== selectedDummy8) return false;
      return true;
    });
  }, [inventory, selectedItemName, selectedTranNo, selectedBrand, selectedStyle, selectedColor, selectedPolish, selectedSize, selectedDummy7, selectedDummy8]);

  const uniqueItemNames = React.useMemo(() => {
    const filterByOthers = (excludeKey: string) => {
      return inventory.filter(item => {
        if (excludeKey !== 'itemName' && selectedItemName && item.itemName !== selectedItemName) return false;
        if (excludeKey !== 'tranNo' && selectedTranNo && item.tranNo !== selectedTranNo) return false;
        if (excludeKey !== 'brand' && selectedBrand && item.brand !== selectedBrand) return false;
        if (excludeKey !== 'style' && selectedStyle && item.style !== selectedStyle) return false;
        if (excludeKey !== 'color' && selectedColor && item.color !== selectedColor) return false;
        if (excludeKey !== 'polish' && selectedPolish && item.polish !== selectedPolish) return false;
        if (excludeKey !== 'size' && selectedSize && item.size !== selectedSize) return false;
        if (excludeKey !== 'dummy7' && selectedDummy7 && item.dummy7 !== selectedDummy7) return false;
        if (excludeKey !== 'dummy8' && selectedDummy8 && item.dummy8 !== selectedDummy8) return false;
        return true;
      });
    };

    const getUnique = (key: keyof InventoryItem) => Array.from<string>(new Set(filterByOthers(key).map(i => String(i[key])))).filter(Boolean).sort();

    return {
       items: getUnique('itemName'),
       trans: getUnique('tranNo'),
       brands: getUnique('brand'),
       styles: getUnique('style'),
       colors: getUnique('color'),
       polishes: getUnique('polish'),
       sizes: getUnique('size'),
       d7s: getUnique('dummy7'),
       d8s: getUnique('dummy8'),
    };
  }, [inventory, selectedItemName, selectedTranNo, selectedBrand, selectedStyle, selectedColor, selectedPolish, selectedSize, selectedDummy7, selectedDummy8]);

  const visibleDesigns = React.useMemo(() => {
    let designs: string[] = Array.from<string>(new Set(filteredInventory.map(i => i.designNo))).sort();
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        designs = designs.filter((d: string) => d.toLowerCase().includes(lower));
    }
    return designs;
  }, [filteredInventory, searchQuery]);

  const designStockMap = React.useMemo(() => {
    const map = new Map<string, number>();
    filteredInventory.forEach(item => {
        map.set(item.designNo, (map.get(item.designNo) || 0) + item.currentStk);
    });
    return map;
  }, [filteredInventory]);

  const totalTranCount = React.useMemo(() => {
      if (filteredInventory.length === 0) return 0;
      const uniqueTrans = new Set(filteredInventory.map(i => i.tranNo));
      return uniqueTrans.size;
  }, [filteredInventory]);

  const handleItemClick = (designNo: string) => {
    if (!selectedUserName) {
      alert("Please select a User Name before proceeding.");
      return;
    }

    // Update only the most recently visited design
    setLastVisitedDesign(designNo);

    if (selectedDesigns.size > 0) {
        toggleSelection(designNo);
    } else {
        const params = new URLSearchParams();
        if (selectedUserName) params.append('user', selectedUserName);
        if (selectedItemName) params.append('item', selectedItemName);
        if (selectedTranNo) params.append('tran', selectedTranNo);
        if (selectedBrand) params.append('brand', selectedBrand);
        if (selectedStyle) params.append('style', selectedStyle);
        if (selectedColor) params.append('color', selectedColor);
        if (selectedPolish) params.append('polish', selectedPolish);
        if (selectedSize) params.append('size', selectedSize);
        if (selectedDummy7) params.append('d7', selectedDummy7);
        if (selectedDummy8) params.append('d8', selectedDummy8);

        navigate(`/detail/${designNo}?${params.toString()}`);
    }
  };

  const toggleSelection = (designNo: string) => {
    setSelectedDesigns(prev => {
        const next = new Set(prev);
        if (next.has(designNo)) {
            next.delete(designNo);
        } else {
            next.add(designNo);
        }
        return next;
    });
  };

  const toggleSelectAll = () => {
    const allVisibleSelected = visibleDesigns.length > 0 && visibleDesigns.every(d => selectedDesigns.has(d));
    
    if (allVisibleSelected) {
        setSelectedDesigns(prev => {
            const next = new Set(prev);
            visibleDesigns.forEach(d => next.delete(d));
            return next;
        });
    } else {
        setSelectedDesigns(prev => {
            const next = new Set(prev);
            visibleDesigns.forEach(d => next.add(d));
            return next;
        });
    }
  };

  const handleBulkMove = () => {
      if (!selectedUserName) {
          alert("Please select a User Name first.");
          return;
      }
      if (selectedDesigns.size === 0) return;
      const designs = Array.from(selectedDesigns).join(',');
      const params = new URLSearchParams();
      params.append('designs', designs);
      params.append('user', selectedUserName);
      
      if (selectedItemName) params.append('item', selectedItemName);
      if (selectedTranNo) params.append('tran', selectedTranNo);
      if (selectedBrand) params.append('brand', selectedBrand);
      if (selectedStyle) params.append('style', selectedStyle);
      if (selectedColor) params.append('color', selectedColor);
      if (selectedPolish) params.append('polish', selectedPolish);
      if (selectedSize) params.append('size', selectedSize);
      if (selectedDummy7) params.append('d7', selectedDummy7);
      if (selectedDummy8) params.append('d8', selectedDummy8);

      navigate(`/bulk-detail?${params.toString()}`);
  };

  const getFilterStyle = (value: string) => {
    return value ? "bg-yellow-300 border-black text-black font-bold placeholder-gray-800 focus:border-black" : "";
  };

  return (
    <div className="flex flex-col h-full bg-white min-h-screen p-4 pb-20 relative">
      {/* Top Section */}
      <div className="flex flex-col md:flex-row items-start md:items-stretch justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
             <SyncBanner />
             <div className="w-full md:w-48 relative h-10">
                {loadingUsers ? (
                  <div className="w-full h-full bg-green-500 border-2 border-green-600 flex items-center justify-center text-white text-xs">Loading...</div>
                ) : (
                  <select
                      value={selectedUserName}
                      onChange={(e) => setSelectedUserName(e.target.value)}
                      className="w-full bg-green-500 border-2 border-green-600 text-black font-semibold text-center h-full focus:outline-none focus:bg-green-400 cursor-pointer appearance-none px-2 rounded-none"
                      style={{ textAlignLast: 'center' }}
                  >
                      <option value="" className="bg-white text-gray-500">Select User</option>
                      {userOptions.map((user) => (
                        <option key={user} value={user} className="bg-white text-black">
                          {user}
                        </option>
                      ))}
                  </select>
                )}
             </div>
             
             <div className="flex items-center gap-2">
                <div className="bg-gray-300 px-3 py-2 rounded text-xs font-bold text-gray-700 shadow-sm whitespace-nowrap border border-gray-400 h-10 flex items-center">
                   Total Count: <span className="text-black ml-1 text-sm">{totalTranCount}</span>
                </div>
                {lastSavedSerial && (
                    <div className="bg-[#ff0000] px-3 py-1 rounded text-xs font-bold text-white shadow-sm whitespace-nowrap flex flex-col items-center justify-center h-10 border border-red-800">
                       <span className="text-[10px] text-yellow-100 uppercase leading-none mb-0.5">Last Saved</span>
                       <span className="text-sm text-yellow-300 font-extrabold leading-none">{lastSavedSerial}</span>
                    </div>
                )}
             </div>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap md:flex-nowrap items-center w-full md:w-auto">
            {/* Text Search Box */}
            <div className="relative h-10 w-full md:w-40">
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-500" />
                </div>
                <input
                    type="text"
                    className="block w-full h-full pl-8 pr-6 border border-gray-300 rounded shadow-sm leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    placeholder="Search Design..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                 {searchQuery && (
                     <button 
                         onClick={() => setSearchQuery('')}
                         className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                     >
                         <X className="w-3 h-3" />
                     </button>
                 )}
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-3 py-2 rounded shadow-md flex items-center gap-2 font-semibold transition-colors shrink-0 text-xs md:text-sm h-10"
                title="Upload exported CSV"
            >
                <Upload className="w-4 h-4" />
                Upload
            </button>

            <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-2 rounded shadow-md flex items-center gap-2 font-semibold transition-colors shrink-0 text-xs md:text-sm h-10"
                title="Refresh"
            >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? '...' : 'Refresh'}
            </button>

            <button
              onClick={toggleSelectAll}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded shadow-md border border-gray-400 transition-colors flex items-center gap-2 font-semibold text-xs md:text-sm h-10"
              title="Select or Deselect Visible Items"
            >
              {visibleDesigns.length > 0 && visibleDesigns.every(d => selectedDesigns.has(d)) ? (
                 <>
                   <CheckSquare className="w-4 h-4 text-blue-600" />
                   Deselect
                 </>
             ) : (
                 <>
                   <Square className="w-4 h-4" />
                   Select All
                 </>
             )}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        <SearchableSelect options={uniqueItemNames.items} value={selectedItemName} onChange={setSelectedItemName} placeholder="Select Item" className={getFilterStyle(selectedItemName)} />
        <SearchableSelect options={uniqueItemNames.trans} value={selectedTranNo} onChange={setSelectedTranNo} placeholder="Select Tran No" className={getFilterStyle(selectedTranNo)} />
        <SearchableSelect options={uniqueItemNames.brands} value={selectedBrand} onChange={setSelectedBrand} placeholder="Brand" className={getFilterStyle(selectedBrand)} />
        <SearchableSelect options={uniqueItemNames.styles} value={selectedStyle} onChange={setSelectedStyle} placeholder="Style" className={getFilterStyle(selectedStyle)} />
        <SearchableSelect options={uniqueItemNames.colors} value={selectedColor} onChange={setSelectedColor} placeholder="Color" className={getFilterStyle(selectedColor)} />
        <SearchableSelect options={uniqueItemNames.polishes} value={selectedPolish} onChange={setSelectedPolish} placeholder="Polish" className={getFilterStyle(selectedPolish)} />
        <SearchableSelect options={uniqueItemNames.sizes} value={selectedSize} onChange={setSelectedSize} placeholder="Size" className={getFilterStyle(selectedSize)} />
        <SearchableSelect options={uniqueItemNames.d7s} value={selectedDummy7} onChange={setSelectedDummy7} placeholder="Dummy 7" className={getFilterStyle(selectedDummy7)} />
        <SearchableSelect options={uniqueItemNames.d8s} value={selectedDummy8} onChange={setSelectedDummy8} placeholder="Dummy 8" className={getFilterStyle(selectedDummy8)} />
      </div>

      {/* Main Content: Image Grid */}
      <div className="bg-white p-4 shadow-lg border border-gray-400 mb-8 min-h-[400px] rounded">
        {loading && inventory.length === 0 ? (
          <div className="flex justify-center items-center h-64">
             <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
             <span className="ml-3 text-gray-600 font-medium">Loading Sheet Data...</span>
          </div>
        ) : inventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
             <span className="text-lg font-semibold mb-2">No Data Loaded</span>
             <p className="mb-4">Failed to fetch inventory or sheet is empty.</p>
             <button onClick={handleRefresh} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">Retry</button>
          </div>
        ) : visibleDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
             <span className="text-lg font-semibold mb-2">
                 {searchQuery ? `No matches for "${searchQuery}"` : "No designs match the current filters."}
             </span>
             <button onClick={handleRefresh} className="text-blue-600 hover:underline flex items-center gap-1 font-bold">
                <RefreshCw className="w-4 h-4" /> Reset Filters
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {visibleDesigns.map(dNo => {
                 const isSelected = selectedDesigns.has(dNo);
                 const isVisited = lastVisitedDesign === dNo;
                 
                 return (
                     <div 
                         key={dNo} 
                         className={`border rounded shadow-sm hover:shadow-md transition-all bg-white flex flex-col group overflow-hidden relative 
                            ${isSelected ? 'ring-4 ring-blue-500 z-10' : 'border-gray-300'}
                            ${isVisited && !isSelected ? 'ring-4 ring-orange-400 z-10' : ''}
                         `}
                         onClick={() => handleItemClick(dNo)}
                     >
                         {/* Selection Checkbox Overlay */}
                         <div 
                            className="absolute top-2 left-2 z-20 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleSelection(dNo);
                            }}
                         >
                            <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => {}} 
                                className="w-5 h-5 cursor-pointer accent-blue-600 shadow-sm"
                            />
                         </div>

                         {/* Active View Indicator */}
                         {isVisited && (
                           <div className="absolute bottom-14 right-2 z-20 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shadow-sm">
                              <Eye className="w-3 h-3" /> Last Viewed
                           </div>
                         )}
                         
                         <div 
                           className="aspect-square bg-white flex items-center justify-center cursor-pointer relative overflow-hidden"
                           onClick={(e) => {
                             e.stopPropagation();
                             setLastVisitedDesign(dNo);
                             window.open(`${IMAGE_BASE_URL}${dNo}.jpg`, '_blank');
                           }}
                         >
                             <img 
                                src={`${IMAGE_BASE_URL}${dNo}.jpg`}
                                alt={dNo}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/200x200?text=No+Img';
                                }}
                                loading="lazy"
                             />
                             {isSelected && (
                                <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg pointer-events-none">
                                    <CheckSquare className="w-5 h-5" />
                                </div>
                             )}
                         </div>
                         <div className="p-2 flex flex-col items-center justify-center bg-white border-t border-gray-200">
                             <span className={`font-extrabold text-xl 
                                ${isSelected ? 'text-blue-700' : isVisited ? 'text-orange-600' : 'text-[#1a4b8c]'}
                             `}>{dNo}</span>
                             <span className="text-xs text-gray-600 font-medium mt-1">
                                 Qty: <span className="text-black font-bold">{designStockMap.get(dNo) || 0}</span>
                             </span>
                         </div>
                     </div>
                 );
             })}
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedDesigns.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-2xl p-4 z-50 animate-in slide-in-from-bottom duration-300 flex justify-center">
              <div className="max-w-7xl w-full flex items-center justify-between px-4">
                  <div className="font-bold text-gray-700">
                      <span className="text-blue-600 text-xl mr-2">{selectedDesigns.size}</span>
                      Designs Selected
                  </div>
                  <button
                      onClick={handleBulkMove}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg shadow-lg font-bold flex items-center gap-2 text-lg transition-transform hover:scale-105"
                  >
                      <Layers className="w-6 h-6" />
                      Move Selected Designs
                  </button>
              </div>
          </div>
      )}

      {/* Success Popup - Recent Items History */}
      {savedPopupItems.length > 0 && (
        <div className="fixed bottom-24 right-4 z-[100] max-w-sm w-full bg-[#1a4b8c] text-white rounded-lg shadow-2xl border-2 border-green-400 animate-in slide-in-from-right duration-500">
          <div className="flex items-center justify-between p-3 border-b border-blue-800 bg-[#153e75] rounded-t-lg">
             <div className="font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>Saved Successfully</span>
             </div>
             <button onClick={() => setSavedPopupItems([])} className="text-blue-200 hover:text-white transition-colors" title="Close">
                <X className="w-5 h-5" />
             </button>
          </div>
          <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1 bg-[#0d2a52]">
             {savedPopupItems.map((item, idx) => {
               const isPrev = item.type === 'previous';
               return (
               <div key={idx} className={`bg-white rounded shadow-sm overflow-hidden flex items-stretch min-h-[3rem] ${isPrev ? 'bg-gray-100 border-t border-gray-300 opacity-90' : 'mb-1'}`}>
                   {/* Left: SL NO */}
                   <div className={`${isPrev ? 'bg-gray-500' : 'bg-green-600'} w-16 flex flex-col items-center justify-center p-1 shrink-0`}>
                       <span className={`text-[10px] uppercase font-bold tracking-wider ${isPrev ? 'text-gray-200' : 'text-green-100'}`}>
                           {isPrev ? 'PREV' : 'SL NO'}
                       </span>
                       <span className="text-2xl font-extrabold text-white leading-none">{item.slNo}</span>
                   </div>
                   
                   {/* Right: Details */}
                   <div className="flex-1 p-2 flex flex-col justify-center text-gray-800 bg-white relative">
                        {isPrev && (
                            <div className="absolute top-1 right-2">
                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded font-bold uppercase border border-gray-300">History</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs text-gray-500 uppercase font-bold">Design:</span>
                            <span className={`text-lg font-bold leading-none ${isPrev ? 'text-gray-600' : 'text-[#1a4b8c]'}`}>{item.designNo}</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-500 uppercase font-bold">Tran:</span>
                             <span className="text-sm font-semibold text-gray-700">{item.tranNo}</span>
                        </div>
                   </div>
               </div>
               );
             })}
          </div>
        </div>
      )}
    </div>
  );
};
