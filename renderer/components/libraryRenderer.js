import { state } from '../store/state.js';
import { els } from '../utils/dom.js';

export function renderDirectoryList() {
  els.directoryList.innerHTML = '';

  if (state.libraryDirectories.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'px-3 py-1 bg-[#2a2a2a] rounded-full text-xs font-semibold opacity-60';
    empty.textContent = 'Nenhuma pasta adicionada';
    els.directoryList.appendChild(empty);
    return;
  }

  for (const dir of state.libraryDirectories) {
    const chip = document.createElement('span');
    chip.className = 'px-3 py-1 bg-[#2a2a2a] rounded-full text-[11px] uppercase tracking-widest font-bold text-white border border-[#474747] truncate max-w-[200px] hover:bg-[#353535] cursor-default transition-colors';
    chip.title = dir;
    chip.textContent = dir.split(/[\\/]/).pop();
    els.directoryList.appendChild(chip);
  }
}

export async function fetchAndDisplayCover(filePath, imgEl) {
  try {
    const ext = filePath.toLowerCase().split('.').pop();
    if (ext === 'pdf') {
      imgEl.src = ''; // PDF covers are complex natively, keeping light for now
      return;
    }
    
    const base64Cover = await window.mhq.getComicCover(filePath);
    if (base64Cover) {
      imgEl.src = base64Cover;
      imgEl.classList.remove('opacity-0');
      imgEl.classList.add('opacity-100');
    }
  } catch (err) {
    console.error('Error fetching cover for', filePath, err);
  }
}

export function renderLibraryItems(onItemClick) {
  els.libraryGrid.innerHTML = '';

  els.libraryMeta.textContent = `${state.libraryItems.length} Titles`;

  if (state.libraryItems.length === 0) {
    els.libraryEmpty.classList.remove('hidden');
    els.libraryEmpty.classList.add('flex');
    return;
  }

  els.libraryEmpty.classList.add('hidden');
  els.libraryEmpty.classList.remove('flex');

  state.libraryItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'group cursor-pointer';
    card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;
    card.addEventListener('click', () => onItemClick(item.filePath));

    const coverWrapper = document.createElement('div');
    coverWrapper.className = 'aspect-[2/3] w-full bg-[#2a2a2a] rounded-md overflow-hidden relative mb-4 transition-transform duration-300 group-hover:scale-[1.02] shadow-2xl shadow-black/50 flex items-center justify-center';
    
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[#c6c6c6] opacity-30 text-4xl absolute z-0';
    icon.textContent = 'image';
    
    const imgEl = document.createElement('img');
    imgEl.className = 'w-full h-full object-cover transition-opacity duration-500 opacity-0 relative z-10';
    
    const overlay = document.createElement('div');
    overlay.className = 'absolute bottom-0 left-0 right-0 h-1 bg-[#353535] z-20';
    
    const progress = document.createElement('div');
    progress.className = 'h-full bg-[#ffffff] w-[0%]';
    
    overlay.appendChild(progress);
    coverWrapper.appendChild(icon);
    coverWrapper.appendChild(imgEl);
    coverWrapper.appendChild(overlay);

    const titleEl = document.createElement('h4');
    titleEl.className = 'font-bold text-sm text-white mb-1 group-hover:text-[#ffffff] transition-colors truncate';
    titleEl.title = item.title;
    titleEl.textContent = item.title;

    const subEl = document.createElement('p');
    subEl.className = 'text-[11px] text-[#c6c6c6] truncate';
    
    const cleanDir = item.directory.replace(/\\/g, '/').split('/').pop();
    subEl.textContent = `${item.extension.toUpperCase()} • ${cleanDir}`;

    card.appendChild(coverWrapper);
    card.appendChild(titleEl);
    card.appendChild(subEl);

    els.libraryGrid.appendChild(card);

    fetchAndDisplayCover(item.filePath, imgEl);
  });
}
