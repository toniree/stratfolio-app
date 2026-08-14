import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { startMarketData } from '@/store/priceStore'
import { AppShell } from '@/components/shell/AppShell'
import { PortfolioPage } from '@/routes/PortfolioPage'
import { PositionsPage } from '@/routes/PositionsPage'
import { PositionDetailsPage } from '@/routes/PositionDetailsPage'
import { IdeasPage } from '@/routes/IdeasPage'
import { RecDetailsPage } from '@/routes/RecDetailsPage'
import { NewsPage } from '@/routes/NewsPage'
import { ArticlePage } from '@/routes/ArticlePage'
import { PlannerPage } from '@/routes/PlannerPage'
import { ResearchPage } from '@/routes/ResearchPage'
import { PlannerIdeaDetailsPage } from '@/routes/PlannerIdeaDetailsPage'
import { ActivityPage } from '@/routes/ActivityPage'
import { ProfilePage } from '@/routes/ProfilePage'
import { AuthPage } from '@/routes/AuthPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export default function App() {
  // One simulator interval for the whole app, started once at boot.
  useEffect(() => startMarketData(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/app/portfolio" replace />} />

          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />

          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/portfolio" replace />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="positions" element={<PositionsPage />} />
            <Route path="positions/:id" element={<PositionDetailsPage />} />
            <Route path="thesis" element={<IdeasPage />} />
            <Route path="thesis/:id" element={<RecDetailsPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="news/:id" element={<ArticlePage />} />
            <Route path="plan" element={<PlannerPage />} />
            <Route path="plan/:id" element={<PlannerIdeaDetailsPage />} />
            <Route path="research" element={<ResearchPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/app/portfolio" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
