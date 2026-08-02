export const metadata = {
  title: 'Wafina — Política de Privacidade / Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-6)' }}>
      <div className="stack">
        <header className="stack" style={{ gap: 'var(--space-2)' }}>
          <h1 style={{ fontSize: 28 }}>Política de Privacidade</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Última atualização: 2 de agosto de 2026
          </p>
        </header>

        <p>
          Esta política de privacidade aplica-se à plataforma Wafina na sua totalidade: as aplicações
          móveis <strong>Wafina Doador</strong> e <strong>Wafina Instituição</strong> (Android e iOS), e
          as aplicações web de Doador, Instituição e Administração. É operada por{' '}
          <strong>ZUINDER - PRESTAÇÃO SERVIÇOS COMÉRCIO GERAL, LDA</strong>. Para qualquer questão sobre
          esta política ou sobre os seus dados, contacte-nos em{' '}
          <a href="mailto:support@zuinder.com">support@zuinder.com</a>.
        </p>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>1. Dados que recolhemos</h2>
          <ul style={{ paddingLeft: '1.25em', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li><strong>Dados de conta:</strong> nome, e-mail, número de telefone e país, recolhidos através do
              Firebase Authentication e do formulário de perfil.</li>
            <li><strong>Localização:</strong> coordenadas geográficas do local de recolha de uma doação (Doador)
              ou da morada da instituição (Instituição), usadas apenas para mostrar e coordenar entregas.</li>
            <li><strong>Fotografias:</strong> imagens de doações, logótipos de instituições e fotos associadas a
              Histórias de Impacto, carregadas voluntariamente pelo utilizador.</li>
            <li><strong>Dados de utilização da plataforma:</strong> registos de doações (categoria, quantidade,
              datas, estado), histórico de contribuições e eventuais ocorrências/disputas reportadas.</li>
          </ul>
          <p>Não recolhemos dados de pagamento — a Wafina não processa transações monetárias dentro da
            aplicação; apenas coordena a doação de bens físicos, tanto perecíveis (alimentos frescos,
            refeições preparadas) como não perecíveis (roupa, material escolar, mercearia, artigos de
            higiene e outros bens essenciais).</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>2. Como usamos os dados</h2>
          <p>Usamos os dados acima exclusivamente para viabilizar o encontro entre doadores e instituições
            verificadas, confirmar a legitimidade de uma instituição antes de a tornar visível na plataforma,
            permitir a comunicação e as notificações dentro da aplicação relativas às suas próprias doações, e
            gerar estatísticas de impacto agregadas.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>3. Partilha de dados</h2>
          <p>Partilhamos apenas o estritamente necessário à concretização de uma doação — por exemplo, a
            localização de recolha e, mediante o seu consentimento, o seu nome — com a instituição ou doador do
            outro lado dessa doação específica. Utilizamos ainda a infraestrutura da Google (Firebase
            Authentication, Google Sheets e Google Drive) como prestadores de serviços que armazenam e
            processam estes dados em nosso nome, sob as respetivas políticas de proteção de dados da Google.
            <strong> Não vendemos os seus dados a terceiros e não utilizamos publicidade nem rastreamento
            de terceiros.</strong></p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>4. Retenção e os seus direitos</h2>
          <p>Mantemos os seus dados enquanto a sua conta estiver ativa. Pode solicitar o acesso, a correção ou
            a eliminação dos seus dados a qualquer momento, contactando{' '}
            <a href="mailto:support@zuinder.com">support@zuinder.com</a>.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>5. Segurança</h2>
          <p>O acesso à sua conta é protegido pelo Firebase Authentication, e todas as autorizações são
            verificadas do lado do servidor em cada pedido. Todas as ligações entre a aplicação e os nossos
            servidores usam HTTPS.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>6. Menores de idade</h2>
          <p>A Wafina não se destina a menores de 13 anos e não recolhemos intencionalmente dados de menores
            de 13 anos.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>7. Transferências internacionais</h2>
          <p>Como utilizamos infraestrutura da Google (Firebase, Sheets, Drive), os seus dados podem ser
            processados em servidores fora do seu país de residência.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>8. Alterações a esta política</h2>
          <p>Podemos atualizar esta política ocasionalmente. A data no topo desta página indica a versão mais
            recente.</p>
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />

        <header className="stack" style={{ gap: 'var(--space-2)' }}>
          <h1 style={{ fontSize: 28 }}>Privacy Policy</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>Last updated: August 2, 2026</p>
        </header>

        <p>
          This privacy policy covers the entire Wafina platform: the <strong>Wafina Doador</strong> and{' '}
          <strong>Wafina Instituição</strong> mobile apps (Android and iOS), and the Donor, Institution, and
          Admin web applications. It is operated by{' '}
          <strong>ZUINDER - PRESTAÇÃO SERVIÇOS COMÉRCIO GERAL, LDA</strong>. For any question about this
          policy or your data, contact us at <a href="mailto:support@zuinder.com">support@zuinder.com</a>.
        </p>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>1. Data we collect</h2>
          <ul style={{ paddingLeft: '1.25em', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li><strong>Account data:</strong> name, email, phone number, and country, collected via Firebase
              Authentication and the profile form.</li>
            <li><strong>Location:</strong> the geographic coordinates of a donation pickup point (Donor) or an
              institution's address (Institution), used only to display and coordinate deliveries.</li>
            <li><strong>Photos:</strong> donation images, institution logos, and photos attached to Impact
              Stories, all voluntarily uploaded by the user.</li>
            <li><strong>Platform usage data:</strong> donation records (category, quantity, dates, status),
              contribution history, and any disputes/incidents reported.</li>
          </ul>
          <p>We do not collect payment data — Wafina does not process monetary transactions in-app; it only
            coordinates the donation of physical goods, both perishable (fresh food, prepared meals) and
            non-perishable (clothing, school supplies, groceries, hygiene items, and other everyday
            essentials).</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>2. How we use data</h2>
          <p>We use the data above solely to match donors with verified institutions, confirm an institution's
            legitimacy before making it visible on the platform, enable in-app communication and notifications
            about your own donations, and generate aggregate impact statistics.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>3. Data sharing</h2>
          <p>We share only what a specific donation requires — for example, the pickup location and, with your
            consent, your name — with the institution or donor on the other side of that donation. We also use
            Google infrastructure (Firebase Authentication, Google Sheets, and Google Drive) as service
            providers that store and process this data on our behalf, under Google's own data-protection
            policies. <strong>We do not sell your data to third parties and we do not use third-party
            advertising or tracking.</strong></p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>4. Retention and your rights</h2>
          <p>We keep your data for as long as your account remains active. You may request access, correction,
            or deletion of your data at any time by contacting{' '}
            <a href="mailto:support@zuinder.com">support@zuinder.com</a>.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>5. Security</h2>
          <p>Access to your account is protected by Firebase Authentication, and every authorization is
            verified server-side on each request. All connections between the app and our servers use HTTPS.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>6. Children's privacy</h2>
          <p>Wafina is not directed at children under 13, and we do not knowingly collect data from children
            under 13.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>7. International transfers</h2>
          <p>Because we use Google infrastructure (Firebase, Sheets, Drive), your data may be processed on
            servers outside your country of residence.</p>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 19 }}>8. Changes to this policy</h2>
          <p>We may update this policy from time to time. The date at the top of this page reflects the most
            recent version.</p>
        </section>
      </div>
    </div>
  );
}
