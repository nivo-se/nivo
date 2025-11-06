export interface AllabolagSession {
  cookies: string;
  token: string;
}

/**
 * Fetches a fresh session from Allabolag.se
 * Gets cookies and __RequestVerificationToken for authenticated requests
 */
export async function getAllabolagSession(): Promise<AllabolagSession> {
  console.log('🔐 Fetching new Allabolag session...');
  
  try {
    const response = await fetch('https://www.allabolag.se/', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
    }

    // Extract cookies from response headers
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders.join('; ');

    // Extract __RequestVerificationToken from HTML
    const html = await response.text();
    const tokenMatch = html.match(/name="__RequestVerificationToken"\s+value="([^"]+)"/);
    const token = tokenMatch ? tokenMatch[1] : '';

    if (!token) {
      console.warn('⚠️  No __RequestVerificationToken found in response');
    }

    console.log(`✅ Session established with ${setCookieHeaders.length} cookies`);
    
    return {
      cookies,
      token
    };

  } catch (error) {
    console.error('❌ Failed to establish session:', error);
    throw error;
  }
}

/**
 * Utility function to automatically refresh session on 403 or empty results
 */
export async function withSession<T>(
  fn: (session: AllabolagSession) => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let session = await getAllabolagSession();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(session);
      
      // Check if result is empty (could indicate session issue)
      if (Array.isArray(result) && result.length === 0 && attempt < maxRetries) {
        console.log(`🔄 Empty result on attempt ${attempt + 1}, refreshing session...`);
        session = await getAllabolagSession();
        continue;
      }
      
      return result;
      
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a 403 or session-related error
      if ((error.message?.includes('403') || error.message?.includes('Forbidden')) && attempt < maxRetries) {
        console.log(`🔄 403 error on attempt ${attempt + 1}, refreshing session...`);
        session = await getAllabolagSession();
        continue;
      }
      
      // If it's not a session error or we've exhausted retries, throw
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
