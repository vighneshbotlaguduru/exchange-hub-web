import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import "../styles/MainLayout.css";

export default function MainLayout() {
  return <><Navbar /><main className="public-main"><Outlet /></main></>;
}
