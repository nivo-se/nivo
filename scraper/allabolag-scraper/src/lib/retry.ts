export async function withRetry<T>(
  fn: () => Promise<T>, 
  max = 5, 
  baseMs = 2000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try { 
      return await fn(); 
    }
    catch (e: any) {
      attempt++;
      const wait = Math.min(60000, baseMs * 2 ** (attempt - 1));
      if (attempt >= max) throw e;
      
      if (e?.status === 429 || String(e).includes("429")) {
        await new Promise(r => setTimeout(r, wait));
      } else {
        await new Promise(r => setTimeout(r, Math.min(wait, 5000)));
      }
    }
  }
}









