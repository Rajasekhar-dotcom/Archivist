const MEMORY_BANK = 'archivist-mvp';

interface Memory {
  content: string;
  createdAt: string;
}

const globalStore = globalThis as typeof globalThis & {
  __archivistMockBank?: Memory[];
};

const mockBank = globalStore.__archivistMockBank ??= [];

export async function retainMemory(content: string) {
  const apiKey = process.env.HINDSIGHT_API_KEY;
  if (!apiKey) {
    console.log(`[Hindsight Mock] Retained: ${content}`);
    mockBank.push({ content, createdAt: new Date().toISOString() });
    return true;
  }

  try {
    const res = await fetch(`https://api.hindsight.vectorize.io/v1/default/banks/${MEMORY_BANK}/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ items: [{ content }] })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return true;
  } catch (error) {
    console.warn(`[Hindsight API] Retain failed, falling back to mock. Error:`, error);
    mockBank.push({ content, createdAt: new Date().toISOString() });
    return true;
  }
}

export async function recallMemory(query: string): Promise<string[]> {
  const apiKey = process.env.HINDSIGHT_API_KEY;
  if (!apiKey) {
    console.log(`[Hindsight Mock] Recalled for query: ${query}`);
    // For the mock, just return all recent memories containing keywords
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
    const results = mockBank
      .filter(m => keywords.some(k => m.content.toLowerCase().includes(k)))
      .map(m => m.content);
    
    // If no exact keyword match but we have memories, just return the recent ones to simulate general context
    if (results.length === 0 && mockBank.length > 0) {
       return mockBank.slice(-3).map(m => m.content);
    }
    return results;
  }

  try {
    const res = await fetch(`https://api.hindsight.vectorize.io/v1/default/banks/${MEMORY_BANK}/memories/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return data.results.map((r: any) => r.content);
  } catch (error) {
    console.warn(`[Hindsight API] Recall failed, falling back to mock. Error:`, error);
    return mockBank.slice(-3).map(m => m.content);
  }
}

export function getAllMockMemories() {
  return mockBank;
}

export function clearMockMemory() {
  mockBank.length = 0;
}
