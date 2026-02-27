
import * as React from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { IMAGE_BASE_URL } from '../constants';
import { fetchInventoryData, fetchReportData } from '../services/api';
import { InventoryItem } from '../types';
import { Loader2, ArrowLeft, CheckSquare, Square, Layers, Search, X, CheckCircle } from 'lucide-react';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const fItem = searchParams.get('item');
  const fTran = searchParams.get('tran');
  const fBrand = searchParams.get('brand');
  const fStyle = searchParams.get('style');
  const fColor = searchParams.get('color');
  const fPolish = searchParams.get('polish');
  const fSize = searchParams.get('size');
  const fD7 = searchParams.get('d7');
  const fD8 = searchParams.get('d8');
  // fUser is passed in params for Reporting identification, but ignored for filtering
  const fUser = searchParams.get('user');
  const fSl = searchParams.get('sl');

  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Selection State
  const [selectedDesigns, setSelectedDesigns] = React.useState<Set<string>>(new Set());
  
  // Search State
  const [searchQuery, setSearchQuery] = React.useState('');

  // Popup State from Navigation
  // Stores items to display in success popup: current saves + relevant history
  const [savedPopupItems, setSavedPopupItems] = React.useState<{designNo: string, tranNo: string, slNo: string, type?: 'current' | 'previous'}[]>([]);

  // Check for popup data coming from ItemDetail
  React.useEffect(() => {
    // We check if "triggerPopup" is present, meaning we just came from a Save
    if (location.state && location.state.triggerPopup) {
      
      const justSaved = location.state.savedPopupItems || [];
      const displayItems: {designNo: string, tranNo: string, slNo: string, type?: 'current' | 'previous'}[] = [];

      try {
          const raw = sessionStorage.getItem('moved_items_cache');
          const cache = JSON.parse(raw || '[]');
          
          // Build a lookup for fast access: Key = serialNo
          const cacheMap = new Map<string, any>();
          cache.forEach((item: any) => {
              if (item.serialNo) {
                  cacheMap.set(item.serialNo, item);
              }
          });

          // Iterate through just saved items (usually 1, but could be bulk)
          justSaved.forEach((item: any) => {
              // 1. Add the current item
              displayItems.push({ 
                  designNo: item.designNo,
                  tranNo: item.tranNo,
                  slNo: item.slNo,
                  type: 'current' 
              });

              // 2. Look for the immediate predecessor (SL - 1) 
              // Now using Global Sequence, so just find the serial number
              const currentSl = parseInt(item.slNo);
              if (!isNaN(currentSl) && currentSl > 1) {
                  const prevSl = String(currentSl - 1);
                  const prevItem = cacheMap.get(prevSl);
                  if (prevItem) {
                      displayItems.push({
                          designNo: prevItem.designNo || 'N/A', // Cache should have designNo now
                          tranNo: prevItem.tranNo,
                          slNo: prevItem.serialNo,
                          type: 'previous'
                      });
                  }
              }
          });

      } catch (e) {
          console.error("Error processing history for popup", e);
          // Fallback: just show what was passed
          displayItems.push(...justSaved.map((i: any) => ({ ...i, type: 'current' })));
      }
      
      setSavedPopupItems(displayItems);
      
      // Clean history state to prevent popup from showing again on refresh
      window.history.replaceState({}, document.title);
      
      // Auto-hide popup after 10 seconds (longer to read history)
      const timer = setTimeout(() => {
        setSavedPopupItems([]);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  React.useEffect(() => {
    const loadItems = async () => {
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
                    // Dedup check
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

        let filtered = data.reduce((acc, item) => {
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

        // Removed User Filter
        // if (fUser) filtered = filtered.filter(d => d.userName === fUser);

        if (fItem) filtered = filtered.filter(d => d.itemName === fItem);
        if (fTran) filtered = filtered.filter(d => d.tranNo === fTran);
        if (fBrand) filtered = filtered.filter(d => d.brand === fBrand);
        if (fStyle) filtered = filtered.filter(d => d.style === fStyle);
        if (fColor) filtered = filtered.filter(d => d.color === fColor);
        if (fPolish) filtered = filtered.filter(d => d.polish === fPolish);
        if (fSize) filtered = filtered.filter(d => d.size === fSize);
        if (fD7) filtered = filtered.filter(d => d.dummy7 === fD7);
        if (fD8) filtered = filtered.filter(d => d.dummy8 === fD8);
        
        const uniqueDesigns = new Map();
        filtered.forEach(item => {
          if (!uniqueDesigns.has(item.designNo)) {
            uniqueDesigns.set(item.designNo, item);
          }
        });
        
        setItems(Array.from(uniqueDesigns.values()));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [fItem, fTran, fBrand, fStyle, fColor, fPolish, fSize, fD7, fD8, fUser]);

  const visibleItems = React.useMemo(() => {
    if (!searchQuery) return items;
    const lower = searchQuery.toLowerCase();
    return items.filter(item => 
        item.designNo.toLowerCase().includes(lower) ||
        item.itemName.toLowerCase().includes(lower) ||
        item.brand.toLowerCase().includes(lower) ||
        item.style.toLowerCase().includes(lower) ||
        (item.barcodeValue && item.barcodeValue.toLowerCase().includes(lower))
    );
  }, [items, searchQuery]);

  const getTitle = () => {
    const parts = [];
    // Only show user in title for context, but it doesn't limit data
    if (fUser) parts.push(`[${fUser}]`);
    if (fItem) parts.push(fItem);
    if (fTran) parts.push(`(${fTran})`);
    if (fBrand) parts.push(fBrand);
    return parts.length > 0 ? `Gallery: ${parts.join(' ')}` : 'All Items Gallery';
  };

  const handleItemClick = (designNo: string) => {
    // If we have a selection, clicking the title toggles selection instead of navigating
    if (selectedDesigns.size > 0) {
       toggleSelection(designNo);
    } else {
       // Clean params before navigating to avoid carrying over 'designs' from bulk mode
       const params = new URLSearchParams(searchParams);
       params.delete('designs');
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
      const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(i => selectedDesigns.has(i.designNo));
      
      if (allVisibleSelected) {
          // Deselect Visible
          setSelectedDesigns(prev => {
              const next = new Set(prev);
              visibleItems.forEach(i => next.delete(i.designNo));
              return next;
          });
      } else {
          // Select Visible
          setSelectedDesigns(prev => {
              const next = new Set(prev);
              visibleItems.forEach(i => next.add(i.designNo));
              return next;
          });
      }
  };

  const handleBulkMove = () => {
      if (selectedDesigns.size === 0) return;
      const designs = Array.from(selectedDesigns).join(',');
      const params = new URLSearchParams(searchParams);
      params.set('designs', designs);
      navigate(`/bulk-detail?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-2 relative pb-20">
      <div className="w-full max-w-7xl mb-4 flex flex-col md:flex-row items-center justify-between relative py-2 gap-4">
        <div className="flex items-center gap-2 z-10 w-full md:w-auto">
            <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-700 hover:text-blue-800 font-bold px-3 py-1 rounded hover:bg-gray-200 transition-colors"
            >
            <ArrowLeft className="w-6 h-6 mr-1" />
            Back
            </button>
            <button
             onClick={toggleSelectAll}
             className="flex items-center text-gray-700 hover:text-blue-800 font-semibold px-3 py-1 rounded hover:bg-gray-200 transition-colors ml-2"
            >
             {visibleItems.length > 0 && visibleItems.every(i => selectedDesigns.has(i.designNo)) ? (
                 <>
                   <CheckSquare className="w-5 h-5 mr-1 text-blue-600" />
                   Deselect Visible
                 </>
             ) : (
                 <>
                   <Square className="w-5 h-5 mr-1" />
                   Select Visible
                 </>
             )}
            </button>
        </div>
        
        <h2 className="text-xl md:text-2xl font-bold text-[#1a4b8c] md:absolute md:left-0 md:right-0 md:text-center w-full pointer-events-none truncate px-16 hidden md:block">
          {getTitle()}
        </h2>
        
        {/* Mobile Title */}
        <h2 className="text-lg font-bold text-[#1a4b8c] md:hidden">
            {getTitle()}
        </h2>

        {/* Search Box */}
        <div className="relative z-10 w-full md:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-500" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition duration-150 ease-in-out shadow-sm"
                placeholder="Search gallery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
             {searchQuery && (
                 <button 
                     onClick={() => setSearchQuery('')}
                     className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                 >
                     <X className="w-4 h-4" />
                 </button>
             )}
        </div>
      </div>

      <div className="w-full max-w-7xl bg-white shadow-xl border border-gray-400 min-h-[500px]">
        {loading ? (
          <div className="flex justify-center items-center h-64 w-full">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 font-medium">Loading Gallery...</span>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
             {items.length > 0 ? `No items match "${searchQuery}"` : "No images found for the selected criteria."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
            {visibleItems.map((item) => {
              const imageUrl = `${IMAGE_BASE_URL}${item.designNo}.jpg`;
              const isSelected = selectedDesigns.has(item.designNo);

              return (
                <div key={item.designNo} className={`flex flex-col border border-gray-400 relative group transition-all ${isSelected ? 'ring-4 ring-blue-500 ring-inset z-10' : ''}`}>
                  <div className="w-full bg-white py-1 flex items-center border-b border-gray-300 relative">
                     {/* Checkbox Area */}
                     <div 
                        className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center cursor-pointer hover:bg-gray-100 z-20"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(item.designNo);
                        }}
                     >
                         <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => {}} // Handled by div click
                            className="w-5 h-5 cursor-pointer accent-blue-600"
                         />
                     </div>
                     
                     <button
                        onClick={() => handleItemClick(item.designNo)}
                        className="w-full text-center hover:bg-blue-50 transition-colors pl-8"
                     >
                        <span className="text-[#1a4b8c] font-bold underline cursor-pointer text-sm sm:text-base">
                        {item.designNo}
                        </span>
                     </button>
                  </div>

                  <div 
                    className="aspect-square w-full bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer relative"
                    onClick={() => {
                        window.open(imageUrl, '_blank');
                    }}
                    title={`View ${item.designNo} full size`}
                  >
                    <img 
                      src={imageUrl} 
                      alt={item.designNo}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/300x300?text=No+Image';
                      }}
                    />
                    {/* Overlay checkmark if selected */}
                    {isSelected && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg pointer-events-none">
                            <CheckSquare className="w-6 h-6" />
                        </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="h-6 bg-[#b66c8b] w-full border-t border-gray-600"></div>
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
        <div className="fixed bottom-4 right-4 z-[100] max-w-sm w-full bg-[#1a4b8c] text-white rounded-lg shadow-2xl border-2 border-green-400 animate-in slide-in-from-right duration-500">
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
