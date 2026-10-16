import { requireRole } from '@/lib/auth/session';
import { WorkspaceShell } from '@/components/workspace-shell';

export const dynamic = 'force-dynamic'; // authenticated pages are never cached across users
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['candidate'], '/dashboard');
  return (
    <WorkspaceShell title="Candidate" nav={[
      { href: '/dashboard', label: 'Overview' }, { href: '/placements', label: 'Student Placements' }, { href: '/jobs', label: 'Find Opportunities' },
      { href: '/dashboard/applications', label: 'My Applications' }, { href: '/dashboard/saved', label: 'Saved' }, { href: '/dashboard/notifications', label: 'Notifications' },
      { href: '/dashboard/cvs', label: 'My CVs' }, { href: '/dashboard/documents', label: 'Documents' }, { href: '/dashboard/cover-letters', label: 'Cover Letters' }, { href: '#', label: 'Career Assistant', soon: true }, { href: '/dashboard/profile', label: 'Profile' }, { href: '/dashboard/settings', label: 'Settings' },
    ]}>{children}</WorkspaceShell>
  );
}
