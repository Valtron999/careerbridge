import { requireRole } from '@/lib/auth/session';
import { WorkspaceShell } from '@/components/workspace-shell';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['admin', 'super_admin'], '/admin');
  return <WorkspaceShell title="Admin" nav={[{ href: '/admin', label: 'Overview' }, { href: '/admin/opportunities', label: 'Listing moderation' }, { href: '/admin/verifications', label: 'Verifications' }, { href: '/admin/reports', label: 'Reports' }, { href: '/admin/audit-logs', label: 'Audit logs' }, { href: '#', label: 'Users', soon: true }, { href: '#', label: 'Categories', soon: true }]}>{children}</WorkspaceShell>;
}
