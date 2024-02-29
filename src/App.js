import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import StyledJS from "./pages/StyledJS";
import Layout from "./components/Layout";
import BootstrapPage from "./pages/BootstrapPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<BootstrapPage />} />
          <Route path="styled" element={<StyledJS />} />
          <Route path="*" element={<NoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const NoPage = () => {
  return <h1>404</h1>;
};