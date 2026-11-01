export interface NaradaEvidenceBrowserAPI {
  isElectron: boolean
  open: (params: { caseId: string; bounds?: { x: number; y: number; width: number; height: number } }) => Promise<{ success: boolean; activeCaseId: string; sessionPartition: string }>
  navigate: (url: string) => Promise<{ success: boolean; url?: string; reason?: string }>
  goBack: () => void
  goForward: () => void
  reload: () => void
  stop: () => void
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) => void
  setVisible: (visible: boolean) => void
  prepareCapture: () => Promise<{
    success: boolean
    caseId: string
    finalUrl: string
    canonicalUrl?: string
    pageTitle?: string
    siteName?: string
    author?: string
    publishedAtRaw?: string
    description?: string
    selectedText: string
    selectedTextStatus: 'present' | 'empty' | 'truncated'
    selectedTextLength: number
    isTruncated: boolean
    screenshotDataUrl?: string
    screenshotByteSha256?: string
    selectedTextByteSha256?: string
    manifestSha256?: string
    capturedAt: string
  }>
  close: () => Promise<{ success: boolean }>
  getStatus: () => Promise<{
    isActive: boolean
    activeCaseId: string | null
    currentUrl: string
    currentTitle: string
    isLoading: boolean
  }>
  onStateChange: (callback: (data: any) => void) => () => void
}

declare global {
  interface Window {
    naradaEvidenceBrowser?: NaradaEvidenceBrowserAPI
  }
}
