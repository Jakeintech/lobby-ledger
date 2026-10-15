import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from '@/components/Layout';
import { ROUTE_PATTERNS } from '@/lib/routes';
import { AboutPage } from '@/pages/AboutPage';
import { BillPage } from '@/pages/BillPage';
import { BillsPage } from '@/pages/BillsPage';
import { ClientPage } from '@/pages/ClientPage';
import { FirmPage } from '@/pages/FirmPage';
import { ForeignCountryPage } from '@/pages/ForeignCountryPage';
import { ForeignPage } from '@/pages/ForeignPage';
import { HomePage } from '@/pages/HomePage';
import { LobbiedEntityPage } from '@/pages/LobbiedEntityPage';
import { LobbiedPage } from '@/pages/LobbiedPage';
import { LobbyistPage } from '@/pages/LobbyistPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RevolvingDoorPage } from '@/pages/RevolvingDoorPage';
import { TopicPage } from '@/pages/TopicPage';
import { TrendPage } from '@/pages/TrendPage';
import { TrendsPage } from '@/pages/TrendsPage';

/** When the filings were last pulled. The pages task can replace this with a value read from Gold. */
const FRESHNESS = 'Filings pulled 15 October 2026.';

export default function App() {
  return (
    <BrowserRouter>
      <Layout freshness={FRESHNESS}>
        <Routes>
          <Route path={ROUTE_PATTERNS.home} element={<HomePage />} />
          <Route path={ROUTE_PATTERNS.topic} element={<TopicPage />} />
          <Route path={ROUTE_PATTERNS.bills} element={<BillsPage />} />
          {/* A bare bill key resolves to its newest Congress through bill_lookup inside BillPage. */}
          <Route path={ROUTE_PATTERNS.bill} element={<BillPage />} />
          <Route path={ROUTE_PATTERNS.billInCongress} element={<BillPage />} />
          <Route path={ROUTE_PATTERNS.client} element={<ClientPage />} />
          <Route path={ROUTE_PATTERNS.firm} element={<FirmPage />} />
          <Route path={ROUTE_PATTERNS.lobbyist} element={<LobbyistPage />} />
          <Route path={ROUTE_PATTERNS.trends} element={<TrendsPage />} />
          <Route path={ROUTE_PATTERNS.trend} element={<TrendPage />} />
          <Route path={ROUTE_PATTERNS.foreign} element={<ForeignPage />} />
          <Route path={ROUTE_PATTERNS.foreignCountry} element={<ForeignCountryPage />} />
          <Route path={ROUTE_PATTERNS.lobbied} element={<LobbiedPage />} />
          <Route path={ROUTE_PATTERNS.lobbiedEntity} element={<LobbiedEntityPage />} />
          <Route path={ROUTE_PATTERNS.revolvingDoor} element={<RevolvingDoorPage />} />
          <Route path={ROUTE_PATTERNS.about} element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
