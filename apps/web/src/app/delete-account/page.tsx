export const metadata = {
  title: 'Wafina — Eliminar Conta / Delete Account',
};

export default function DeleteAccountPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-6)' }}>
      <div className="stack">
        <header className="stack" style={{ gap: 'var(--space-2)' }}>
          <h1 style={{ fontSize: 28 }}>Eliminar a Sua Conta</h1>
        </header>

        <p>
          Para solicitar a eliminação da sua conta Wafina (Doador ou Instituição) e de todos os dados
          associados — perfil, histórico de doações, fotografias e mensagens — envie um e-mail para{' '}
          <a href="mailto:support@zuinder.com?subject=Pedido%20de%20elimina%C3%A7%C3%A3o%20de%20conta">
            support@zuinder.com
          </a>{' '}
          a partir do endereço de e-mail associado à sua conta, com o assunto "Pedido de eliminação de
          conta".
        </p>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>O que é eliminado</h2>
          <p>O seu perfil (nome, e-mail, telefone, país), histórico de doações e fotografias
            associadas à sua conta. Processamos o pedido no prazo de 30 dias e confirmamos por
            e-mail assim que estiver concluído.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>O que pode ser mantido</h2>
          <p>Registos de doações já entregues a uma instituição podem ser mantidos de forma anonimizada
            para efeitos de estatísticas de impacto agregadas, sem qualquer dado que o identifique.</p>
        </section>

        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          Para saber mais sobre como tratamos os seus dados, consulte a nossa{' '}
          <a href="/privacy">Política de Privacidade</a>.
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />

        <header className="stack" style={{ gap: 'var(--space-2)' }}>
          <h1 style={{ fontSize: 28 }}>Delete Your Account</h1>
        </header>

        <p>
          To request deletion of your Wafina account (Donor or Institution) and all associated data —
          profile, donation history, photos, and messages — email{' '}
          <a href="mailto:support@zuinder.com?subject=Account%20deletion%20request">
            support@zuinder.com
          </a>{' '}
          from the email address associated with your account, with the subject "Account deletion
          request".
        </p>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>What gets deleted</h2>
          <p>Your profile (name, email, phone, country), donation history, and photos associated with
            your account. We process requests within 30 days and confirm by email once complete.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>What may be retained</h2>
          <p>Records of donations already delivered to an institution may be kept in anonymized form
            for aggregate impact statistics, with no data that identifies you.</p>
        </section>

        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          To learn more about how we handle your data, see our{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
