import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(value);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value]);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full md:w-auto min-w-[200px]" ref={wrapperRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={`w-full border px-4 py-2 font-medium shadow-md focus:outline-none pr-10 ${className ? className : 'bg-slate-300 border-slate-500 placeholder-slate-600 text-slate-900 focus:border-blue-500'}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') {
               onChange('');
            }
          }}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-600">
            {value ? (
                <button onClick={handleClear} className="p-1 hover:bg-black/10 rounded-full">
                   <X className={`w-4 h-4 ${className?.includes('text-black') ? 'text-black' : 'text-slate-700'}`} />
                </button>
            ) : (
                <ChevronDown className={`w-5 h-5 pointer-events-none ${className?.includes('text-black') ? 'text-black' : ''}`} />
            )}
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full bg-white border border-gray-300 mt-1 max-h-60 overflow-y-auto shadow-lg rounded-md">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option}
                className={`px-4 py-2 cursor-pointer text-sm text-gray-700 hover:bg-blue-100 ${option === value ? 'bg-blue-50 font-bold' : ''}`}
                onClick={() => {
                  onChange(option);
                  setSearchTerm(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-gray-500 text-sm">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
};