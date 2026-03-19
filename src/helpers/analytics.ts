import { PostHog } from 'posthog-node'

const POSTHOG_API_KEY = 'phc_hD7bhooFbRUWqSWOvRAZiHv4tr6mYYgleeWGkQ52eWD'
const POSTHOG_HOST = 'https://eu.i.posthog.com'

// Capture native fetch before cross-fetch overrides globalThis.fetch in extension.ts
const nativeFetch = globalThis.fetch

let client: PostHog | null = null

export function initAnalytics(): void {
  client = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST, fetch: nativeFetch })
}

export function identifyUser(walletAddress: string): void {
  if (!client) return
  client.identify({ distinctId: walletAddress })
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!client || !distinctId) return
  client.capture({
    distinctId,
    event,
    properties
  })
}

export async function shutdownAnalytics(): Promise<void> {
  if (!client) return
  await client.shutdown()
  client = null
}
