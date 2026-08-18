import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import OrdersList from "./pages/OrdersList";
import RoutePreview from "./pages/RoutePreview";
import OrderForm from "./pages/OrderForm";
import type { ReactNode } from "react";

function NavItem({ to, children }: { to: string; children: ReactNode }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium ${
                    isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                }`
            }
        >
            {children}
        </NavLink>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-slate-50">
                <nav className="border-b border-slate-200 bg-white">
                    <div className="mx-auto flex max-w-3xl gap-2 px-6 py-3">
                        <NavItem to="/orders/new">New order</NavItem>
                        <NavItem to="/orders">Orders</NavItem>
                        <NavItem to="/routes">Routes</NavItem>
                    </div>
                </nav>

                <Routes>
                    <Route path="/" element={<Navigate to="/orders" replace />} />
                    <Route path="/orders/new" element={<OrderForm />} />
                    <Route path="/orders" element={<OrdersList />} />
                    <Route path="/routes" element={<RoutePreview />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}