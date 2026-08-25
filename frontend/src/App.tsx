import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import OrdersList from "./pages/OrdersList";
import RoutePreview from "./pages/RoutePreview";
import OrderForm from "./pages/OrderForm";
import CourierView from "./pages/CourierView";
import type { ReactNode } from "react";
import ClientsList from "./pages/ClientsList";

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
                        <NavItem to="/courier">Courier</NavItem>
                        <NavItem to="/ordersNew">New order</NavItem>
                        <NavItem to="/orders">Orders</NavItem>
                        <NavItem to="/routes">Routes</NavItem>
                        <NavItem to="/clients">Clients</NavItem>
                    </div>
                </nav>

                <Routes>
                    <Route path="/" element={<Navigate to="/orders" replace />} />
                    <Route path="/courier" element={<CourierView />} />
                    <Route path="/ordersNew" element={<OrderForm />} />
                    <Route path="/orders" element={<OrdersList />} />
                    <Route path="/routes" element={<RoutePreview />} />
                    <Route path="/clients" element={<ClientsList />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}