
import * as React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  className?: string;
}

// Helpers
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDate = (dateStr: string) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
};

const formatDisplay = (date: Date) => {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Internal selection state
  const [selStart, setSelStart] = React.useState<Date | null>(null);
  const [selEnd, setSelEnd] = React.useState<Date | null>(null);
  const [viewDate, setViewDate] = React.useState(new Date());

  React.useEffect(() => {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    setSelStart(s);
    setSelEnd(e);
    if (s) {
       setViewDate(new Date(s.getFullYear(), s.getMonth(), 1));
    } else {
       const now = new Date();
       setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }, [startDate, endDate, isOpen]);

  // Click outside to close
  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const handleDayClick = (date: Date) => {
    // If we have a full range or no selection, start new range
    if (!selStart || (selStart && selEnd)) {
      setSelStart(date);
      setSelEnd(null);
    } else {
      // If we have start but no end
      if (date < selStart) {
        setSelStart(date); // User clicked earlier date, make it new start
        setSelEnd(null);
      } else {
        setSelEnd(date);
      }
    }
  };

  const handleApply = () => {
     if (selStart) {
         const s = formatDate(selStart);
         const e = selEnd ? formatDate(selEnd) : ""; // Allow single day selection if end is null? usually range requires end.
         // If end is null, effectively single day range
         onChange(s, e || s);
     } else {
         onChange("", "");
     }
     setIsOpen(false);
  };

  const changeMonth = (offset: number) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + offset);
      setViewDate(newDate);
  };

  const isInRange = (date: Date) => {
    if (!selStart || !selEnd) return false;
    return date > selStart && date < selEnd;
  };

  const isSelected = (date: Date) => {
    if (selStart && date.getTime() === selStart.getTime()) return true;
    if (selEnd && date.getTime() === selEnd.getTime()) return true;
    return false;
  };

  const renderMonth = (baseDate: Date) => {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); 
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

      return (
          <div className="w-64 select-none">
              <div className="text-center font-bold text-gray-800 mb-4">
                  {baseDate.toLocaleString('default', { month: 'short' })} {year}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                 {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                     <div key={d} className="text-xs font-semibold text-gray-500">{d}</div>
                 ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1 gap-x-0 text-sm">
                  {days.map((d, idx) => {
                      if (!d) return <div key={idx} />;
                      
                      const isSel = isSelected(d);
                      const inRange = isInRange(d);
                      const isStart = selStart && d.getTime() === selStart.getTime();
                      const isEnd = selEnd && d.getTime() === selEnd.getTime();
                      
                      // Base styles
                      let btnClasses = "w-8 h-8 flex items-center justify-center text-sm relative z-10 transition-colors duration-150 ";
                      
                      if (isSel) {
                          btnClasses += "bg-[#1a4b8c] text-white font-bold rounded hover:bg-[#163a6b] ";
                      } else if (inRange) {
                          btnClasses += "bg-blue-100 text-gray-900 rounded-none ";
                      } else {
                          btnClasses += "text-gray-700 hover:bg-gray-100 rounded-full ";
                      }

                      // Visual connector logic for range start/end
                      const showConnector = inRange || (isStart && selEnd) || (isEnd && selStart);

                      return (
                          <div key={idx} className={`relative flex items-center justify-center p-0`}>
                             {/* Background strip connecting the range visually */}
                             {showConnector && (
                                <div className={`absolute h-8 bg-blue-100 z-0 top-0 
                                    ${isStart ? 'left-1/2 right-0' : ''}
                                    ${isEnd ? 'left-0 right-1/2' : ''}
                                    ${inRange ? 'left-0 right-0' : ''}
                                `}></div>
                             )}
                             
                             <button 
                                onClick={() => handleDayClick(d)}
                                className={btnClasses}
                             >
                                {d.getDate()}
                             </button>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const nextMonth = new Date(viewDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Button Display Text
  let buttonText = "Select Date Range";
  if (startDate) {
      if (endDate && endDate !== startDate) {
          buttonText = `${formatDisplay(parseDate(startDate)!)} - ${formatDisplay(parseDate(endDate)!)}`;
      } else {
          buttonText = `${formatDisplay(parseDate(startDate)!)}`;
      }
  }

  return (
      <div className={`relative ${className}`} ref={containerRef}>
          <div 
             onClick={() => setIsOpen(!isOpen)}
             className="flex items-center justify-between bg-white border border-gray-300 rounded shadow-sm px-3 h-10 cursor-pointer hover:bg-gray-50 min-w-[240px]"
          >
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-gray-500" />
                <span className={`text-sm ${startDate ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {buttonText}
                </span>
              </div>
              {(startDate || endDate) && (
                  <button onClick={(e) => { e.stopPropagation(); onChange("",""); }} className="p-1 hover:bg-gray-200 rounded-full">
                      <X className="w-3 h-3 text-gray-400" />
                  </button>
              )}
          </div>

          {isOpen && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 p-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  {/* Calendar Nav Buttons - positioned specifically */}
                  <button onClick={() => changeMonth(-1)} className="absolute left-6 top-6 p-1 hover:bg-gray-100 rounded-full z-20">
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <button onClick={() => changeMonth(1)} className="absolute right-6 top-6 p-1 hover:bg-gray-100 rounded-full z-20">
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>

                  <div className="flex flex-col md:flex-row gap-8">
                      {renderMonth(viewDate)}
                      <div className="hidden md:block w-px bg-gray-200"></div>
                      <div className="hidden md:block">{renderMonth(nextMonth)}</div>
                  </div>

                  <div className="w-full border-t border-gray-200 mt-6 pt-4 flex justify-between items-center">
                       <div className="text-sm font-medium text-gray-800">
                           {selStart ? formatDisplay(selStart) : ''}
                           {selStart && selEnd && selStart.getTime() !== selEnd.getTime() ? ` - ${formatDisplay(selEnd)}` : ''}
                       </div>
                       <div className="flex gap-3">
                           <button 
                              onClick={() => setIsOpen(false)}
                              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                           >
                               Cancel
                           </button>
                           <button 
                              onClick={handleApply}
                              className="px-6 py-2 text-sm font-bold text-white bg-[#1a4b8c] hover:bg-blue-800 rounded shadow transition-colors"
                           >
                               Apply
                           </button>
                       </div>
                  </div>
              </div>
          )}
      </div>
  );
};
