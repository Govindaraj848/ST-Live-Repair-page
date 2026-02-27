import * as React from 'react';

export const SyncBanner: React.FC = () => {
  return (
    <div className="w-full md:w-auto mb-2">
      <div className="bg-green-500 border-2 border-green-600 text-black font-semibold py-2 px-6 text-center shadow-sm h-full flex items-center justify-center">
        Data syncing
      </div>
    </div>
  );
};