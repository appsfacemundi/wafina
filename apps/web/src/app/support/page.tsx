export const metadata = {
  title: 'Wafina — Apoio / Support',
};

export default function SupportPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-6)' }}>
      <div className="stack">
        <header className="stack" style={{ gap: 'var(--space-2)' }}>
          <h1 style={{ fontSize: 28 }}>Apoio ao Utilizador</h1>
        </header>

        <p>
          Precisa de ajuda com a <strong>Wafina Doador</strong> ou a <strong>Wafina Instituição</strong>?
          Contacte-nos em <a href="mailto:support@zuinder.com">support@zuinder.com</a> e responderemos o
          mais rapidamente possível.
        </p>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>Perguntas frequentes</h2>
          <ul style={{ paddingLeft: '1.25em', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li>Para questões sobre privacidade e os seus dados, consulte a nossa{' '}
              <a href="/privacy">Política de Privacidade</a>.</li>
            <li>Para os termos de utilização da plataforma, consulte os{' '}
              <a href="/terms">Termos e Condições</a>.</li>
            <li>Para eliminar a sua conta, visite a página de{' '}
              <a href="/delete-account">eliminação de conta</a>.</li>
          </ul>
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />

        <header className="stack" style={{ gap: 'var(--space-2)' }}>
          <h1 style={{ fontSize: 28 }}>User Support</h1>
        </header>

        <p>
          Need help with <strong>Wafina Doador</strong> or <strong>Wafina Instituição</strong>? Contact us
          at <a href="mailto:support@zuinder.com">support@zuinder.com</a> and we'll get back to you as
          soon as possible.
        </p>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>Frequently asked</h2>
          <ul style={{ paddingLeft: '1.25em', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li>For questions about privacy and your data, see our{' '}
              <a href="/privacy">Privacy Policy</a>.</li>
            <li>For the platform's terms of use, see the{' '}
              <a href="/terms">Terms &amp; Conditions</a>.</li>
            <li>To delete your account, visit the{' '}
              <a href="/delete-account">account deletion</a> page.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
