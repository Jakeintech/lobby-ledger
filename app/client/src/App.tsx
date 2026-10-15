import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from '@/components/Layout';
import { ROUTE_PATTERNS } from '@/lib/routes';
import { AboutPage } from '@/pages/AboutPage';
import { BillPage } from '@/pages/BillPage';
import { ClientPage } from '@/pages/ClientPage';
import { FirmPage } from '@/pages/FirmPage';
import { HomePage } from '@/pages/HomePage';
import { LobbyistPage } from '@/pages/LobbyistPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TopicPage } from '@/pages/TopicPage';

/** When the filings were last pulled. The pages task can replace this with a value read from Gold. */
const FRESHNESS = 'Filings pulled 15 October 2026.';

export default function App() {
  return (
    <BrowserRouter>
      <Layout freshness={FRESHNESS}>
        <Routes>
          <Route path={ROUTE_PATTERNS.home} element={<HomePage />} />
          <Route path={ROUTE_PATTERNS.topic} element={<TopicPage />} />
          <Route path={ROUTE_PATTERNS.bill} element={<BillPage />} />
          <Route path={ROUTE_PATTERNS.client} element={<ClientPage />} />
          <Route path={ROUTE_PATTERNS.firm} element={<FirmPage />} />
          <Route path={ROUTE_PATTERNS.lobbyist} element={<LobbyistPage />} />
          <Route path={ROUTE_PATTERNS.about} element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
