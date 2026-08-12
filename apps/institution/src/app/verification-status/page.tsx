'use client';

import { Badge, Button, Card } from '@wafina/ui';
import { useAuth, useRequireSession } from '@/context/AuthContext';
import { useOwnInstitution } from '@/hooks/useOwnInstitution';

export default function VerificationStatusPage() {
  const session = useRequireSession();
  const { signOutUser } = useAuth();
  const { institution, loading } = useOwnInstitution();

  if (!session || loading) return null;

  return (
    <main className="screen-center">
      <Card className="auth-card stack">
        <h1 style={{ fontSize: 22 }}>Estado de verificação</h1>
        {institution?.Verified ? (
          <>
            <Badge tone="success">Verificado</Badge>
            <p style={{ color: 'var(--color-text-muted)' }}>A sua instituição foi verificada.</p>
          </>
        ) : institution?.Rejection_Reason ? (
          <>
            <Badge tone="danger">Rejeitado</Badge>
            <p style={{ color: 'var(--color-text-muted)' }}>{institution.Rejection_Reason}</p>
          </>
        ) : (
          <>
            <Badge tone="warning">Por verificar</Badge>
            <p style={{ color: 'var(--color-text-muted)' }}>
              O seu registo está a aguardar aprovação do Admin. Isto demora normalmente entre 24 a 48 horas.
            </p>
          </>
        )}
        <Button variant="ghost-danger" onClick={() => signOutUser()}>
          Sair
        </Button>
      </Card>
    </main>
  );
}
