export type Payment = {
  id: string
  email: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  amount: number
}

export const payments: Payment[] = [
  { id: 'm5gr84i9', email: 'ken99@example.com', status: 'success', amount: 31600 },
  { id: '3u1reuv4', email: 'abe45@example.com', status: 'success', amount: 24200 },
  { id: 'derv1ws0', email: 'monserrat44@example.com', status: 'processing', amount: 83700 },
  { id: '5kma53ae', email: 'silas22@example.com', status: 'success', amount: 87400 },
  { id: 'bhqecj4p', email: 'carmella@example.com', status: 'failed', amount: 72100 },
]
