import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth/session';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookie();
  if (!session) redirect('/login');
  return <>{children}</>;
}
