/**
 * ══════════════════════════════════════════════════════════════════════════
 * NARADA — PRELOAD SCRIPT FOR TRUSTED MAIN RENDERER (Sprint 7)
 * PUSSIBERAD TNI AD × CODEPOLITAN — KARTIKA CYBER HACKATHON 2026
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * Hanya diekspos ke jendela utama aplikasi NARADA yang terpercaya.
 * Konten halaman web jarak jauh (remote content) TIDAK MENERIMA preload ini.
 * ══════════════════════════════════════════════════════════════════════════
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('naradaEvidenceBrowser', {
  isElectron: true,

  open: (params) => ipcRenderer.invoke('narada:evidence-browser:open', params),
  navigate: (url) => ipcRenderer.invoke('narada:evidence-browser:navigate', url),
  goBack: () => ipcRenderer.send('narada:evidence-browser:back'),
  goForward: () => ipcRenderer.send('narada:evidence-browser:forward'),
  reload: () => ipcRenderer.send('narada:evidence-browser:reload'),
  stop: () => ipcRenderer.send('narada:evidence-browser:stop'),
  setBounds: (bounds) => ipcRenderer.send('narada:evidence-browser:set-bounds', bounds),
  setVisible: (visible) => ipcRenderer.send('narada:evidence-browser:set-visible', visible),
  prepareCapture: () => ipcRenderer.invoke('narada:evidence-browser:prepare-capture'),
  close: () => ipcRenderer.invoke('narada:evidence-browser:close'),
  getStatus: () => ipcRenderer.invoke('narada:evidence-browser:get-status'),

  onStateChange: (callback) => {
    const handler = (event, data) => callback(data)
    ipcRenderer.on('narada:evidence-browser:state-change', handler)
    return () => {
      ipcRenderer.removeListener('narada:evidence-browser:state-change', handler)
    }
  }
})
