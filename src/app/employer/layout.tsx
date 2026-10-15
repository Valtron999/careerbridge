import { requireRole } from '@/lib/auth/session';
import { WorkspaceShell } from '@/components/workspace-shell';
export const dynamic = 'force-dynamic';
export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['employer'], '/employer');
  return <WorkspaceShell title="Employer" nav={[{ href: '/employer', label: 'Overview' }, { href: '/employer/opportunities', label: 'Opportunities' }, { href: '/employer/interviews', label: 'Interviews' }, { href: '/employer/company', label: 'Company profile' }, { href: '/employer/verification', label: 'Verification' }, { href: '#', label: 'Team', soon: true }, { href: '#', label: 'Billing', soon: true }]}>{children}</WorkspaceShell>;
}
