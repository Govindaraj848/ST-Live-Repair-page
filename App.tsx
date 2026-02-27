
import * as React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { InventoryList } from './pages/InventoryList';
import { ItemDetail } from './pages/ItemDetail';
import { ReportPage } from './pages/ReportPage';
import { DataSetPage } from './pages/DataSetPage';
import { Sidebar } from './components/Sidebar';

const App: React.FC = () => {
  return (
    <Router>
      <div className="font-sans text-slate-900 bg-gray-200 min-h-screen relative">
        {/* Persistent Sidebar (Fixed Position, Auto-hiding) */}
        <Sidebar />
        
        {/* Main Content Area */}
        {/* Added left padding to ensure content isn't covered by the collapsed sidebar trigger strip */}
        <div className="w-full min-h-screen pl-3">
          <Routes>
            {/* Route 1: The Main Inventory List (Merged with Gallery features) */}
            <Route path="/" element={<InventoryList />} />
            
            {/* Route 2: The Detail View (Single Item) */}
            <Route path="/detail/:id" element={<ItemDetail />} />

            {/* Route 3: Bulk Detail View for multiple items */}
            <Route path="/bulk-detail" element={<ItemDetail />} />

            {/* Route 4: Report Page */}
            <Route path="/report" element={<ReportPage />} />

            {/* Route 5: Data Set Page */}
            <Route path="/dataset" element={<DataSetPage />} />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
