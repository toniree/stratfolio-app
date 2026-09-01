import type { NewsArticle } from '@/api/newsTypes'
import type { NewsApi } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'
import { DEMO_NEWS } from '@/api/mock/seededNews'

export class MockNewsApi implements NewsApi {
  async getArticles(): Promise<NewsArticle[]> {
    await latency(240)
    return DEMO_NEWS.slice()
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .map((article) => ({ ...article, provenance: 'mock' as const }))
  }

  async getArticle(id: string): Promise<NewsArticle | undefined> {
    await latency(140)
    const article = DEMO_NEWS.find((a) => a.id === id)
    return article ? { ...article, provenance: 'mock' } : undefined
  }
}

export const mockNewsApi = new MockNewsApi()
