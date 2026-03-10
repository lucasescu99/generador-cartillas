import { Routes, Route, Navigate } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage/UploadPage';
import { MappingPage } from './pages/MappingPage/MappingPage';
import { PreviewPage } from './pages/PreviewPage/PreviewPage';
import { GeneratePage } from './pages/GeneratePage/GeneratePage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/mapping" element={<MappingPage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/generate" element={<GeneratePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
