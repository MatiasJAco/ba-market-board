/**
 * src/utils/api-fetcher.ts - Utility function for robust API calling.
 *
 * This utility provides a standardized way to fetch data, including basic
 * error handling and request structure, ready for integration with
 * specific service implementations.
 *
 * @param url - The API endpoint URL.
 * @param options - Fetch options (method, headers, body, etc.).
 * @returns A Promise that resolves with the fetched JSON data.
 */
export async function apiFetcher(url: string, options: RequestInit = {}): Promise<any> {
  console.log(`[Fetcher] Attempting to fetch data from: ${url}`);

  try {
    // Basic simulation to allow for future implementation in T004
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText}. Details: ${errorBody.substring(0, 100)}...`);
    }

    // Attempt to parse JSON, fallback to text if required
    const data = await response.json();
    return data;

  } catch (error) {
    console.error("[Fetcher] Failed to fetch data:", error);
    // Re-throw a standardized error object for consumers to handle
    throw new Error("Failed to retrieve API data: " + (error as Error).message);
  }
}