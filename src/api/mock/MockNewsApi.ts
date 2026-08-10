import type { NewsArticle } from '@/api/newsTypes'
import type { NewsApi } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'
import { DEMO_NEWS } from '@/api/mock/seededNews'

export class MockNewsApi implements NewsApi {
  async getArticles(): Promise<NewsArticle[]> {
    await latency(240)
    return DEMO_NEWS.slice().sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
  }

  async getArticle(id: string): Promise<NewsArticle | undefined> {
    await latency(140)
    return DEMO_NEWS.find((a) => a.id === id)
  }
}

export const mockNewsApi = new MockNewsApi()
