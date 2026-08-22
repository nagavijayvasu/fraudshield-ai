import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { AnalysisPage } from "@/pages/AnalysisPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { RelationshipsPage } from "@/pages/RelationshipsPage";
import { ModelPerformancePage } from "@/pages/ModelPerformancePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/relationships" element={<RelationshipsPage />} />
        <Route path="/model" element={<ModelPerformancePage />} />
      </Routes>
    </BrowserRouter>
  );
}
