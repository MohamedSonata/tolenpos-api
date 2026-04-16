// wasender.service.ts
import { createWasender, RetryConfig, FetchImplementation, Wasender } from "wasenderapi";

// For Node.js < 18 or environments without global fetch, you might need a polyfill
// import fetch from "cross-fetch";
// const customFetch: FetchImplementation = fetch as FetchImplementation;

// Environment variables (typed as string | undefined)
const apiKey: string | undefined = process.env.WASENDER_API_KEY;
const personalAccessToken: string | undefined = process.env.WASENDER_PERSONAL_ACCESS_TOKEN;
const webhookSecret: string | undefined = process.env.WASENDER_WEBHOOK_SECRET;

// Retry configuration
const retryOptions: RetryConfig = {
  enabled: true,
  maxRetries: 3,
};

// Declare a global variable for wasender
let wasender: Wasender | null = null;

/**
 * Initializes the Wasender API service.
 * Call this once at app startup (e.g., in index.ts).
 */
export async function initWasenderApiService(): Promise<void> {
    try {
        wasender = createWasender(
            apiKey,
            personalAccessToken,
            undefined, // baseUrl (defaults to https://www.wasenderapi.com/api)
            undefined, // customFetch (optional)
            retryOptions,
            webhookSecret
        );
        console.log("✅ Wasender SDK Initialized.");
        // const status = await wasender.getSessionStatus();
        // console.log("Wasender SDK Session status:", status);

    } catch (e) {
        console.log("Wasender SDK InitializeError :::", e)
    }


}

/**
 * Getter for the global wasender instance.
 * Ensures that initWasenderApiService() has been called.
 */
export function getWasender(): Wasender {
  if (!wasender) {
    throw new Error("Wasender SDK not initialized. Call initWasenderApiService() first.");
  }
  return wasender;
}

export default getWasender;
