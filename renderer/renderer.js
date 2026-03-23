const homeScreen = document.getElementById('home-screen');
const readerScreen = document.getElementById('reader-screen');
const openComicBtn = document.getElementById('open-comic-btn');
const openOtherBtn = document.getElementById('open-other-btn');
const backHomeBtn = document.getElementById('back-home-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageImage = document.getElementById('page-image');
const loadingText = document.getElementById('loading-text');
const readerSeries = document.getElementById('reader-series');
const readerPageCounter = document.getElementById('reader-page-counter');

const state = {
  title: '',
  kind: null,
  imagePages: [],
  pdfBase64: null,
  pdfDocument: null,
  pdfjsLib: null,
  currentPageIndex: 0,
  totalPages: 0,
  rendering: false,
  pageVersion: 0,
  zoom: 1
};

function showHomeScreen() {
  homeScreen.classList.add('active');
  readerScreen.classList.remove('active');
}

function showReaderScreen() {
  homeScreen.classList.remove('active');
  readerScreen.classList.add('active');
}

function setLoading(message) {
  loadingText.textContent = message;
  loadingText.style.display = 'block';
  pageImage.style.display = 'none';
}

function hideLoading() {
  loadingText.style.display = 'none';
  pageImage.style.display = 'block';
}

function updateHeader() {
  readerSeries.textContent = state.title || '-';
  readerPageCounter.textContent = `Pagina ${state.totalPages === 0 ? 0 : state.currentPageIndex + 1} / ${state.totalPages}`;
}

function updateNavButtons() {
  const noPages = state.totalPages === 0;
  prevBtn.disabled = noPages || state.currentPageIndex <= 0;
  nextBtn.disabled = noPages || state.currentPageIndex >= state.totalPages - 1;
}

function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

async function ensurePdfJs() {
  if (state.pdfjsLib) {
    return state.pdfjsLib;
  }

  const paths = await window.mhq.getPdfJsPaths();
  const pdfjsLib = await import(paths.moduleUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = paths.workerUrl;
  state.pdfjsLib = pdfjsLib;

  return pdfjsLib;
}

async function renderPdfPage(pageNumber, requestVersion) {
  const page = await state.pdfDocument.getPage(pageNumber);

  const viewportAt1x = page.getViewport({ scale: 1 });
  const fitScale = Math.min(
    (window.innerWidth * 0.88) / viewportAt1x.width,
    (window.innerHeight * 0.86) / viewportAt1x.height
  );

  const viewport = page.getViewport({ scale: fitScale * state.zoom });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: context, viewport }).promise;

  if (requestVersion !== state.pageVersion) {
    return;
  }

  pageImage.src = canvas.toDataURL('image/png');
  hideLoading();
}

async function renderCurrentPage() {
  if (state.totalPages === 0) {
    setLoading('Nenhuma pagina disponivel.');
    updateHeader();
    updateNavButtons();
    return;
  }

  updateHeader();
  updateNavButtons();

  if (state.rendering) {
    return;
  }

  state.rendering = true;
  state.pageVersion += 1;
  const requestVersion = state.pageVersion;

  try {
    if (state.kind === 'images') {
      const page = state.imagePages[state.currentPageIndex];
      if (!page) {
        throw new Error('Pagina de imagem nao encontrada.');
      }
      pageImage.src = page.src;
      hideLoading();
    } else if (state.kind === 'pdf') {
      setLoading('Renderizando PDF...');
      await renderPdfPage(state.currentPageIndex + 1, requestVersion);
    }
  } catch (error) {
    setLoading(`Erro ao renderizar pagina: ${error.message}`);
  } finally {
    state.rendering = false;
  }
}

async function loadComicFromPath(filePath) {
  setLoading('Carregando arquivo...');
  showReaderScreen();

  try {
    const result = await window.mhq.loadComic(filePath);

    state.title = result.title;
    state.currentPageIndex = 0;
    state.zoom = 1;
    state.imagePages = [];
    state.pdfBase64 = null;
    state.pdfDocument = null;

    if (result.kind === 'images') {
      state.kind = 'images';
      state.imagePages = result.pages;
      state.totalPages = result.pages.length;
    } else if (result.kind === 'pdf') {
      state.kind = 'pdf';
      state.pdfBase64 = result.pdfBase64;

      const pdfjsLib = await ensurePdfJs();
      const pdfData = base64ToUint8Array(result.pdfBase64);
      state.pdfDocument = await pdfjsLib.getDocument({ data: pdfData }).promise;
      state.totalPages = state.pdfDocument.numPages;
    } else {
      throw new Error('Tipo de conteudo nao suportado pelo renderer.');
    }

    await renderCurrentPage();
  } catch (error) {
    setLoading(`Falha ao abrir HQ: ${error.message}`);
    updateHeader();
    updateNavButtons();
  }
}

async function pickAndOpenComic() {
  const filePath = await window.mhq.openComicFile();
  if (!filePath) {
    return;
  }

  await loadComicFromPath(filePath);
}

function goToNextPage() {
  if (state.currentPageIndex < state.totalPages - 1) {
    state.currentPageIndex += 1;
    renderCurrentPage();
  }
}

function goToPreviousPage() {
  if (state.currentPageIndex > 0) {
    state.currentPageIndex -= 1;
    renderCurrentPage();
  }
}

window.addEventListener('keydown', (event) => {
  if (!readerScreen.classList.contains('active')) {
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    goToNextPage();
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    goToPreviousPage();
  }

  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    state.zoom = Math.min(state.zoom + 0.1, 2.5);
    renderCurrentPage();
  }

  if (event.key === '-' || event.key === '_') {
    event.preventDefault();
    state.zoom = Math.max(state.zoom - 0.1, 0.5);
    renderCurrentPage();
  }
});

window.addEventListener('resize', () => {
  if (readerScreen.classList.contains('active') && state.kind === 'pdf') {
    renderCurrentPage();
  }
});

openComicBtn.addEventListener('click', pickAndOpenComic);
openOtherBtn.addEventListener('click', pickAndOpenComic);
backHomeBtn.addEventListener('click', showHomeScreen);
prevBtn.addEventListener('click', goToPreviousPage);
nextBtn.addEventListener('click', goToNextPage);

showHomeScreen();
updateHeader();
updateNavButtons();
