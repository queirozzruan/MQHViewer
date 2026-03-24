import { state } from '../store/state.js';
import { els } from '../utils/dom.js';

export function updateTransform() {
  const content = els.pageImage;
  if (content) {
    content.style.height = `${state.zoom * 100}vh`;
    content.style.width = 'auto';
    content.style.maxWidth = 'none';
  }
}

export function resetView() {
  updateZoomLabel();
  updateTransform();
  if (els.pageStage) {
    els.pageStage.scrollTop = 0;
    els.pageStage.scrollLeft = 0;
  }
}

export function updateHeader() {
  els.readerSeries.textContent = state.title || '-';
  const current = state.totalPages === 0 ? 0 : state.currentPageIndex + 1;
  const pCurrent = String(current).padStart(3, '0');
  const pTotal = String(state.totalPages).padStart(3, '0');
  els.readerPageCounter.textContent = `P. ${pCurrent} / ${pTotal}`;
  
  if (els.readerProgressBar) {
    const percentage = state.totalPages === 0 ? 0 : (current / state.totalPages) * 100;
    els.readerProgressBar.style.height = `${percentage}%`;
  }
}

export function updateZoomLabel() {
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
}

export function updateNavButtons() {
  const noPages = state.totalPages === 0;
  els.prevBtn.disabled = noPages || state.currentPageIndex <= 0;
  els.nextBtn.disabled = noPages || state.currentPageIndex >= state.totalPages - 1;
}
