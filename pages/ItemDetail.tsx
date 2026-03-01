
import * as React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { InventoryItem, DesignMrpDetail } from '../types';
import { fetchInventoryData, saveMoveToSheet, fetchReportData, fetchDesignMrpDetails } from '../services/api';
import { Loader2, CheckCircle, Save, X } from 'lucide-react';
import { DiscountFlower } from '../components/DiscountFlower';

export const ItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Filters
  const fItem = searchParams.get('item');
  const fTran = searchParams.get('tran');
  const fBrand = searchParams.get('brand');
  const fStyle = searchParams.get('style');
  const fColor = searchParams.get('color');
  const fPolish = searchParams.get('polish');
  const fSize = searchParams.get('size');
  const fD7 = searchParams.get('d7');
  const fD8 = searchParams.get('d8');
  const fUser = searchParams.get('user');
  
  const designsParam = searchParams.get('designs');
  
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [designMrpData, setDesignMrpData] = React.useState<Map<string, DesignMrpDetail>>(new Map());
  const [loading, setLoading] = React.useState(true);
  
  // State to track which items have been successfully saved (to hide them)
  const [savedKeys, setSavedKeys] = React.useState<Set<string>>(new Set());
  
  // State for pending moves: Key -> { reason, qty }
  const [pendingMoves, setPendingMoves] = React.useState<Record<string, { reason: string; qty: number }>>({});

  // Track the order of items marked as 'Selected' to generate SL NO in click-order
  const [selectionOrder, setSelectionOrder] = React.useState<string[]>([]);

  // State for existing max serial number (Global)
  const [maxGlobalSerial, setMaxGlobalSerial] = React.useState<number>(0);

  // Helper to read cache safe
  const getLocalCache = () => {
    try {
        const raw = sessionStorage.getItem('moved_items_cache');
        return JSON.parse(raw || '[]');
    } catch {
        return [];
    }
  };

  // Helper to go back to Inventory List cleanly
  const goBack = () => {
      const params = new URLSearchParams(searchParams);
      params.delete('designs'); // Remove bulk selection context
      navigate(`/?${params.toString()}`);
  };

  React.useEffect(() => {
    const getItems = async () => {
      setLoading(true);
      try {
        const [inventory, reportData, mrpData] = await Promise.all([
             fetchInventoryData(), 
             fetchReportData(),
             fetchDesignMrpDetails()
        ]);
        
        const mrpMap = new Map<string, DesignMrpDetail>();
        mrpData.forEach(item => {
          mrpMap.set(item.designNumber, item);
        });
        setDesignMrpData(mrpMap);

        const reportQtyMap = new Map<string, number>();
        
        // PRIORITIZE: Load last saved serial from session to prevent reset on refresh
        const sessionLastSerial = sessionStorage.getItem('inv_lastSavedSerial');
        let maxSerialFound = sessionLastSerial ? parseInt(sessionLastSerial) : 0;

        // 1. Process Server Report
        const reportTimestamps = new Set(reportData.map(r => r.timestamp));

        reportData.forEach(r => {
             const key = `${r.barcode}_${r.tranNo}`;
             const q = parseInt(r.qty) || 0;
             reportQtyMap.set(key, (reportQtyMap.get(key) || 0) + q);
        });

        // 2. Process Local Session Cache
        const localMoved = getLocalCache();
        if (Array.isArray(localMoved)) {
            localMoved.forEach((entry: any) => {
                const isSynced = (entry && typeof entry === 'object' && entry.timestamp && reportTimestamps.has(entry.timestamp));

                if (entry && typeof entry === 'object' && entry.serialNo) {
                    const s = parseInt(entry.serialNo);
                    if (!isNaN(s) && s > maxSerialFound) {
                        maxSerialFound = s;
                    }
                }

                if (isSynced) return;

                if (typeof entry === 'string') {
                    reportQtyMap.set(entry, (reportQtyMap.get(entry) || 0) + 1);
                } else if (entry && typeof entry === 'object') {
                    const k = entry.key;
                    const q = entry.qty || 0;
                    reportQtyMap.set(k, (reportQtyMap.get(k) || 0) + q);
                }
            });
        }
        
        setMaxGlobalSerial(maxSerialFound);

        const availableInventory = inventory.reduce((acc, item) => {
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
        
        let targetDesigns: string[] = [];
        if (id) {
            targetDesigns = [id];
        } else if (designsParam) {
            targetDesigns = designsParam.split(',').filter(Boolean);
        }

        const foundItems = availableInventory.filter(i => {
           if (!targetDesigns.includes(i.designNo)) return false;
           if (fItem && i.itemName !== fItem) return false;
           if (fTran && i.tranNo !== fTran) return false;
           if (fBrand && i.brand !== fBrand) return false;
           if (fStyle && i.style !== fStyle) return false;
           if (fColor && i.color !== fColor) return false;
           if (fPolish && i.polish !== fPolish) return false;
           if (fSize && i.size !== fSize) return false;
           if (fD7 && i.dummy7 !== fD7) return false;
           if (fD8 && i.dummy8 !== fD8) return false;
           return true;
        });

        const aggregatedMap = new Map<string, InventoryItem>();

        foundItems.forEach(item => {
            const key = [
                item.designNo, item.itemName, item.style, item.color, 
                item.polish, item.size, item.barcodeValue, item.tranNo
            ].join('||');

            if (aggregatedMap.has(key)) {
                const existing = aggregatedMap.get(key)!;
                existing.currentStk += item.currentStk;
            } else {
                aggregatedMap.set(key, { ...item });
            }
        });

        setItems(Array.from(aggregatedMap.values()));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    getItems();
  }, [id, designsParam, fItem, fTran, fBrand, fStyle, fColor, fPolish, fSize, fD7, fD8, fUser]);

  const getUniqueKey = (item: InventoryItem, indexInFullList: number) => {
      return `${item.barcodeValue || item.designNo}_${indexInFullList}`;
  };

  const handleReasonChange = (key: string, reason: string, maxQty: number) => {
    setPendingMoves(prev => {
      const oldReason = prev[key]?.reason;
      const updated = { ...prev };
      
      if (reason) {
        updated[key] = { reason, qty: prev[key]?.qty || 1 };
        
        // Track order if changed to 'Selected'
        if (reason === 'Selected' && oldReason !== 'Selected') {
          setSelectionOrder(order => [...order, key]);
        } else if (reason !== 'Selected' && oldReason === 'Selected') {
          setSelectionOrder(order => order.filter(k => k !== key));
        }
      } else {
        delete updated[key];
        if (oldReason === 'Selected') {
          setSelectionOrder(order => order.filter(k => k !== key));
        }
      }
      return updated;
    });
  };

  const handleQtyChange = (key: string, qtyStr: string, maxQty: number) => {
      let qty = parseInt(qtyStr) || 1;
      if (qty < 1) qty = 1;
      if (qty > maxQty) qty = maxQty;

      setPendingMoves(prev => {
          if (!prev[key]) return prev;
          return { ...prev, [key]: { ...prev[key], qty } };
      });
  };

  const handleSave = () => {
    const movesToProcess: { 
        key: string; 
        item: InventoryItem; 
        reason: string; 
        qty: number; 
        calculatedSlNo: string 
    }[] = [];

    // Map to find items easily by key
    const itemMap = new Map<string, {item: InventoryItem, originalIndex: number}>();
    items.forEach((item, idx) => itemMap.set(getUniqueKey(item, idx), {item, originalIndex: idx}));

    // 1. Process 'Selected' items in their specific order
    selectionOrder.forEach((key, index) => {
        const entry = itemMap.get(key);
        const move = pendingMoves[key];
        if (entry && move) {
            movesToProcess.push({
                key,
                item: entry.item,
                reason: 'Selected',
                qty: move.qty,
                calculatedSlNo: String(maxGlobalSerial + index + 1)
            });
        }
    });

    // 2. Process other reasons (Damage, etc.) which don't have SL NO
    Object.keys(pendingMoves).forEach(key => {
        if (selectionOrder.includes(key)) return; // Already processed
        const entry = itemMap.get(key);
        const move = pendingMoves[key];
        if (entry && move) {
            movesToProcess.push({
                key,
                item: entry.item,
                reason: move.reason,
                qty: move.qty,
                calculatedSlNo: ""
            });
        }
    });

    if (movesToProcess.length === 0) {
      alert("Please select a move reason for at least one item.");
      return;
    }

    const currentUser = fUser || "";
    const newSavedKeys = new Set(savedKeys);
    let maxSerialSaved = maxGlobalSerial;
    
    const newLocalMoves: any[] = [];
    const savedItemsDetails: any[] = [];
    const batchTimestamp = new Date().toLocaleString();

    movesToProcess.forEach(({ key, item, reason, qty, calculatedSlNo }) => {
        // If the item has a discount from the MRP API, use that. Otherwise use the item's existing discount.
        const mrpDetail = designMrpData.get(item.designNo);
        let finalDiscount = item.discount;
        if (mrpDetail && mrpDetail.discount) {
          finalDiscount = `${mrpDetail.discount}${mrpDetail.type?.toLowerCase() === 'silver' ? ' Silver' : ''}`;
        }
        
        const itemToSave = { ...item, discount: finalDiscount };

        saveMoveToSheet(itemToSave, reason, currentUser, calculatedSlNo, qty, batchTimestamp);
        
        newLocalMoves.push({ 
            key: `${item.barcodeValue}_${item.tranNo}`, 
            qty,
            timestamp: batchTimestamp,
            tranNo: item.tranNo,
            serialNo: calculatedSlNo,
            reason,
            designNo: item.designNo
        });

        if (qty >= item.currentStk) newSavedKeys.add(key);
        
        if (calculatedSlNo) {
            savedItemsDetails.push({ designNo: item.designNo, tranNo: item.tranNo, slNo: calculatedSlNo });
            const sVal = parseInt(calculatedSlNo);
            if (!isNaN(sVal) && sVal > maxSerialSaved) maxSerialSaved = sVal;
        }
    });

    try {
        const currentCache = getLocalCache();
        sessionStorage.setItem('moved_items_cache', JSON.stringify([...currentCache, ...newLocalMoves]));
    } catch (e) { console.error(e); }

    if (maxSerialSaved > maxGlobalSerial) setMaxGlobalSerial(maxSerialSaved);
    setSavedKeys(newSavedKeys);
    setPendingMoves({});
    setSelectionOrder([]);
    
    if (maxSerialSaved > 0) sessionStorage.setItem('inv_lastSavedSerial', String(maxSerialSaved));
    
    const params = new URLSearchParams(searchParams);
    params.delete('designs');
    navigate(`/?${params.toString()}`, { state: { savedPopupItems: savedItemsDetails, triggerPopup: true } });
  };

  const visibleItems = React.useMemo(() => {
    return items
        .map((item, index) => ({ item, originalIndex: index }))
        .filter(({ item, originalIndex }) => !savedKeys.has(getUniqueKey(item, originalIndex)));
  }, [items, savedKeys]);

  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-gray-200">
       <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
       <p className="mt-4 text-gray-700">Loading details...</p>
    </div>
  );

  if (items.length === 0) return (
    <div className="min-h-screen bg-gray-200 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded shadow text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">No Items Found</h2>
            <button onClick={goBack} className="bg-[#1a4b8c] text-white px-6 py-2 rounded">Go Back</button>
        </div>
    </div>
  );

  const showEmptyState = visibleItems.length === 0;

  return (
    <div className="flex flex-col h-full bg-gray-200 min-h-screen p-4 relative">
      {!showEmptyState && (
        <>
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg md:text-xl font-bold text-[#1a4b8c]">{designsParam ? 'Bulk Move' : `Design: ${id}`}</h1>
            </div>
            
            <div className="overflow-x-auto bg-white shadow-lg border border-gray-400 mb-8 mt-2">
                <table className="w-full text-sm text-center border-collapse">
                <thead>
                    <tr className="bg-[#ff9900] text-black font-bold uppercase text-xs md:text-sm">
                    <th className="p-2 border-r border-gray-600 sticky left-0 bg-[#ff9900] z-20 shadow-md">D NO</th>
                    <th className="p-2 border-r border-gray-600">COMB IMG</th>
                    <th className="p-2 border-r border-gray-600">ITEM NAME</th>
                    <th className="p-2 border-r border-gray-600">STYLE</th>
                    <th className="p-2 border-r border-gray-600">COLOR</th>
                    <th className="p-2 border-r border-gray-600">POLISH</th>
                    <th className="p-2 border-r border-gray-600">SIZE</th>
                    <th className="p-2 border-r border-gray-600">BRAND</th>
                    <th className="p-2 border-r border-gray-600">D 7</th>
                    <th className="p-2 border-r border-gray-600">D 8</th>
                    <th className="p-2 border-r border-gray-600">TRAN DATE</th>
                    <th className="p-2 border-r border-gray-600">TRAN NO</th>
                    <th className="p-2 border-r border-gray-600 bg-black text-white">SL NO</th>
                    <th className="p-2 border-r border-gray-600">BARCODE VALUE</th>
                    <th className="p-2 border-r border-gray-600">DISCOUNT</th>
                    <th className="p-2 border-r border-gray-600">C STK.</th>
                    <th className="p-2 w-32">MOVE QTY</th>
                    <th className="p-2 w-32">REASON</th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {visibleItems.map(({ item, originalIndex }) => {
                    const uniqueKey = getUniqueKey(item, originalIndex);
                    const currentMove = pendingMoves[uniqueKey];
                    
                    let displaySlNo = "";
                    if (currentMove && currentMove.reason === 'Selected') {
                        const orderIdx = selectionOrder.indexOf(uniqueKey);
                        if (orderIdx !== -1) {
                            displaySlNo = String(maxGlobalSerial + orderIdx + 1);
                        }
                    }

                    const combImageUrl = item.combId && item.combId !== '0' && item.combId !== 'NA' 
                        ? `https://kushals-hq-prod.s3.ap-south-1.amazonaws.com/images/${item.combId}.jpg`
                        : null;

                    const mrpDetail = designMrpData.get(item.designNo);
                    let displayDiscount = item.discount;
                    let hasDiscount = item.discount && item.discount !== '0' && item.discount !== '0%' && item.discount !== 'NA' && item.discount.trim() !== '';
                    
                    if (mrpDetail && mrpDetail.discount) {
                        displayDiscount = `${mrpDetail.discount}${mrpDetail.type?.toLowerCase() === 'silver' ? ' Silver' : ''}`;
                        hasDiscount = true;
                    }

                    const rowBg = hasDiscount ? 'bg-[#38761D]' : 'bg-white';
                    const rowText = hasDiscount ? 'text-white font-bold' : 'text-gray-900';

                    return (
                        <tr key={uniqueKey} className={`${rowBg} ${rowText} font-medium text-sm md:text-base border-b border-gray-200`}>
                            <td className={`p-2 border border-gray-400 sticky left-0 ${rowBg} z-10 shadow-md`}>{item.designNo}</td>
                            <td className="p-1 border border-gray-400">
                            {combImageUrl ? (
                                <div className="w-32 h-32 mx-auto cursor-pointer" onClick={() => window.open(combImageUrl, '_blank')}>
                                    <img src={combImageUrl} alt="Comb" className="w-full h-full object-cover border border-gray-200" />
                                </div>
                            ) : <span className="text-gray-400 text-xs">No Img</span>}
                            </td>
                            <td className="p-2 border border-gray-400">{item.itemName}</td>
                            <td className="p-2 border border-gray-400">{item.style}</td>
                            <td className="p-2 border border-gray-400">{item.color}</td>
                            <td className="p-2 border border-gray-400">{item.polish}</td>
                            <td className="p-2 border border-gray-400">{item.size}</td>
                            <td className="p-2 border border-gray-400">{item.brand}</td>
                            <td className="p-2 border border-gray-400">{item.dummy7}</td>
                            <td className="p-2 border border-gray-400">{item.dummy8}</td>
                            <td className="p-2 border border-gray-400 whitespace-nowrap">{item.tranDate}</td>
                            <td className="p-2 border border-gray-400">{item.tranNo}</td>
                            <td className="p-2 border border-gray-400 font-bold text-red-600 bg-yellow-100 text-gray-900">
                                {displaySlNo}
                            </td>
                            <td className="p-2 border border-gray-400 relative pl-4 text-left">
                            <div className="absolute top-0 left-0 w-0 h-0 border-t-[6px] border-t-green-600 border-r-[6px] border-r-transparent"></div>
                            {item.barcodeValue}
                            </td>
                            <td className={`p-2 border border-gray-400 ${hasDiscount ? 'font-extrabold text-[#FFFF08]' : ''}`}>
                                {mrpDetail && mrpDetail.discount ? (
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <DiscountFlower discount={mrpDetail.discount} type={mrpDetail.type} className="w-6 h-6" />
                                        <span>{displayDiscount}</span>
                                    </div>
                                ) : (
                                    displayDiscount
                                )}
                            </td>
                            <td className="p-2 border border-gray-400">{item.currentStk}</td>
                            <td className="p-2 border border-gray-400">
                                {currentMove ? (
                                    <input 
                                        type="number" min="1" max={item.currentStk}
                                        value={currentMove.qty}
                                        onChange={(e) => handleQtyChange(uniqueKey, e.target.value, item.currentStk)}
                                        className="w-16 p-1 border rounded text-center text-black font-bold bg-white"
                                    />
                                ) : "-"}
                            </td>
                            <td className="p-2 border border-gray-400">
                            <select 
                                value={currentMove?.reason || ""}
                                onChange={(e) => handleReasonChange(uniqueKey, e.target.value, item.currentStk)}
                                className={`w-full p-1 border rounded focus:outline-none cursor-pointer text-gray-900 ${
                                currentMove ? 'bg-blue-50 border-blue-500 text-blue-800 font-bold' : 'bg-white border-gray-300'
                                }`}
                            >
                                <option value="">Select...</option>
                                <option value="Selected">Selected</option>
                                <option value="MI & MR">MI & MR</option>
                                <option value="Damage">Damage</option>
                                <option value="Wastage">Wastage</option>
                            </select>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <button onClick={goBack} className="bg-[#1a4b8c] text-white px-8 py-3 rounded hover:bg-blue-900 transition-colors shadow-lg font-semibold w-full sm:w-auto">
                    Back to List
                </button>
                {Object.keys(pendingMoves).length > 0 && (
                <button onClick={handleSave} className="bg-green-600 text-white px-8 py-3 rounded hover:bg-green-700 transition-all shadow-lg font-bold flex items-center justify-center gap-2 w-full sm:w-auto animate-pulse">
                    <Save className="w-5 h-5" /> Save Changes ({Object.keys(pendingMoves).length})
                </button>
                )}
            </div>
        </>
      )}

      {showEmptyState && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-10 rounded-lg shadow-xl text-center max-w-md w-full border border-green-200">
                <div className="flex justify-center mb-4"><CheckCircle className="w-16 h-16 text-green-600" /></div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">All Items Processed</h2>
                <button onClick={goBack} className="w-full bg-[#1a4b8c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors shadow-md">
                    Return to List
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
