import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Triggers from './pages/Triggers';
import AllTriggers from './pages/AllTriggers';
import Items from './pages/Items';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import { Hosts, Templates } from './pages/HostsAndTemplates';
import Groups from './pages/Groups';
import Connections from './pages/Connections';
import Users from './pages/Admin/Users';
import Areas from './pages/Admin/Areas';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
      ◈ carregando...
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="hosts" element={<Hosts />} />
 	    <Route path="groups" element={<Groups />} />
            <Route path="templates" element={<Templates />} />
            <Route path="triggers" element={<Triggers />} />
            <Route path="alltriggers" element={<AllTriggers key={window.location.search} />} />
            <Route path="items" element={<Items key={window.location.search} />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<Audit />} />
            <Route path="admin/connections" element={<Connections />} />
            <Route path="admin/users" element={<Users />} />
            <Route path="admin/areas" element={<Areas />} />
            <Route path="admin/*" element={<div style={{ padding: 28, color: 'var(--text-secondary)' }}>⚙ Página de administração em breve</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}