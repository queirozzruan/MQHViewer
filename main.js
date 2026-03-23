const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');
const AdmZip = require('adm-zip');

function isSupportedExtension(ext) {
  return ['.pdf', '.cbz', '.cbr'].includes(ext.toLowerCase());
}

function isImageFile(fileName) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);
}

function getMimeByExt(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function sortAlphabetically(items, getKey) {
  return [...items].sort((a, b) =>
    getKey(a).localeCompare(getKey(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );
}

async function extractCbzPages(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const imageEntries = sortAlphabetically(
    entries.filter((entry) => !entry.isDirectory && isImageFile(entry.entryName)),
    (entry) => entry.entryName
  );

  if (imageEntries.length === 0) {
    throw new Error('Nenhuma imagem encontrada no arquivo CBZ.');
  }

  return imageEntries.map((entry) => {
    const fileName = entry.entryName;
    const data = entry.getData();
    const mime = getMimeByExt(fileName);
    return {
      name: fileName,
      src: `data:${mime};base64,${data.toString('base64')}`
    };
  });
}

async function extractCbrPages(filePath) {
  const { createExtractorFromData } = require('node-unrar-js');
  const archiveData = await fs.readFile(filePath);

  const extractor = await createExtractorFromData({
    data: Uint8Array.from(archiveData)
  });

  const fileListResult = extractor.getFileList();
  if (!Array.isArray(fileListResult) || fileListResult[0]?.state !== 'SUCCESS') {
    throw new Error('Falha ao ler lista de arquivos do CBR.');
  }

  const fileHeaders = fileListResult[1]?.fileHeaders ?? [];
  const imageHeaders = sortAlphabetically(
    fileHeaders.filter((header) => !header.flags?.directory && isImageFile(header.name)),
    (header) => header.name
  );

  if (imageHeaders.length === 0) {
    throw new Error('Nenhuma imagem encontrada no arquivo CBR.');
  }

  const targetFiles = imageHeaders.map((header) => header.name);
  const extractedResult = extractor.extract({ files: targetFiles });

  if (!Array.isArray(extractedResult) || extractedResult[0]?.state !== 'SUCCESS') {
    throw new Error('Falha ao extrair imagens do CBR.');
  }

  const extractedFiles = extractedResult[1]?.files ?? [];
  const pages = [];

  for (const file of extractedFiles) {
    const fileName = file.fileHeader?.name ?? '';
    const extracted = file.extraction ?? file.extract?.[1] ?? null;

    if (!fileName || !extracted || !isImageFile(fileName)) {
      continue;
    }

    const imageBuffer = Buffer.from(extracted);
    const mime = getMimeByExt(fileName);

    pages.push({
      name: fileName,
      src: `data:${mime};base64,${imageBuffer.toString('base64')}`
    });
  }

  if (pages.length === 0) {
    throw new Error('As imagens do CBR nao puderam ser extraidas.');
  }

  return sortAlphabetically(pages, (page) => page.name);
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0e0e0e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('dialog:open-comic-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Abrir HQ / Manga',
    properties: ['openFile'],
    filters: [
      { name: 'HQ e Manga', extensions: ['pdf', 'cbz', 'cbr'] },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('pdfjs:get-paths', async () => {
  const modulePath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

  return {
    moduleUrl: pathToFileURL(modulePath).href,
    workerUrl: pathToFileURL(workerPath).href
  };
});

ipcMain.handle('comic:load', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('Caminho de arquivo invalido.');
  }

  const resolvedPath = path.resolve(filePath);
  const ext = path.extname(resolvedPath).toLowerCase();

  if (!isSupportedExtension(ext)) {
    throw new Error('Formato nao suportado. Use .pdf, .cbz ou .cbr');
  }

  if (ext === '.pdf') {
    const buffer = await fs.readFile(resolvedPath);
    return {
      kind: 'pdf',
      title: path.basename(resolvedPath, ext),
      fileName: path.basename(resolvedPath),
      pdfBase64: buffer.toString('base64')
    };
  }

  if (ext === '.cbz') {
    const pages = await extractCbzPages(resolvedPath);
    return {
      kind: 'images',
      title: path.basename(resolvedPath, ext),
      fileName: path.basename(resolvedPath),
      pages
    };
  }

  const pages = await extractCbrPages(resolvedPath);
  return {
    kind: 'images',
    title: path.basename(resolvedPath, ext),
    fileName: path.basename(resolvedPath),
    pages
  };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

