import { AdminLayoutInner } from './AdminLayout';

export default function KOTLayout({ children }) {
  return <AdminLayoutInner portal="kot">{children}</AdminLayoutInner>;
}
