import { Routes, Route, Navigate } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage/UploadPage';
import { MappingPage } from './pages/MappingPage/MappingPage';
import { OrderPage } from './pages/OrderPage/OrderPage';
import { PreviewPage } from './pages/PreviewPage/PreviewPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/mapping" element={<MappingPage />} />
      <Route path="/order" element={<OrderPage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/generate" element={<Navigate to="/preview" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
