const { app, BrowserWindow, session, shell } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

function allowMidi(permission) {
  return (
    permission === 'midi' ||
    permission === 'midiSysex' ||
    permission === 'media'
  )
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: 'Keys',
    backgroundColor: '#0c1220',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173')
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(allowMidi(permission))
    },
  )
  session.defaultSession.setPermissionCheckHandler(
    (_wc, permission) => allowMidi(permission),
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
