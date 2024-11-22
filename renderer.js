document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('query');
  const resultsList = document.getElementById('results');
  let selectedIndex = -1;
  let isSearching = false;

  function debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  const updateSelection = () => {
    const items = resultsList.querySelectorAll('li');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === selectedIndex);
    });

    if (selectedIndex >= 0) {
      const selectedItem = items[selectedIndex];
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  };

  const showLoading = () => {
    resultsList.innerHTML = `<li class="disabled" style="color: #aaa; text-align: center;font-size: 2em;">搜索中...</li>`;
    resultsList.style.display = 'block';
  };

  const performSearch = async () => {
    const query = input.value.trim();
    if (!query) {
      isSearching = false;
      resultsList.innerHTML = '';
      resultsList.style.display = 'none';
      return;
    }

    isSearching = true;
    showLoading();

    try {
      const results = await window.api.searchEverything(query);

      isSearching = false;

      if (!results || results.length === 0) {
        resultsList.innerHTML = `<li class="disabled" style="color: #aaa; text-align: center;font-size: 2em;">无结果</li>`;
        resultsList.style.display = 'block';
        return;
      }

      resultsList.innerHTML = '';
      results.forEach((result) => {
        const li = document.createElement('li');
        const fileName = result.split('\\').pop();
        const filePath = result;

        li.dataset.filePath = filePath;
        li.innerHTML = `<div>${fileName}</div><div style="font-size: 0.8em; color: #aaa;">${filePath}</div>`;
        resultsList.appendChild(li);
      });
      resultsList.style.display = 'block';
    } catch (error) {
      isSearching = false;
      console.error('搜索出现错误:', error);
      resultsList.innerHTML = `<li class="disabled" style="color: red; text-align: center;font-size: 2em;">搜索失败</li>`;
      resultsList.style.display = 'block';
    }
  };

  const handleKeyDown = (event) => {
    const items = resultsList.querySelectorAll('li:not(.disabled)');
    if (items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelection();
        break;

      case 'ArrowUp':
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateSelection();
        break;

      case 'Enter':
        if (selectedIndex >= 0) {
          const selectedItem = items[selectedIndex];
          if (selectedItem) {
            const filePath = selectedItem.dataset.filePath;

            try {
              window.api.openFile(filePath);
              console.log(`File opened: ${filePath}`);
            } catch (error) {
              console.error(`Error opening file: ${error.message}`);
            }
          }
        }
        break;

      case 'Escape':
        selectedIndex = -1;
        updateSelection();
        input.value = '';
        resultsList.innerHTML = '';
        resultsList.style.display = 'none';
        break;

      default:
        break;
    }
  };

  const handleItemClick = (event) => {
    const clickedItem = event.target.closest('li:not(.disabled)');
    if (!clickedItem) return;

    const filePath = clickedItem.dataset.filePath;
    window.api.openFile(filePath);
  };

  const debouncedSearch = debounce(performSearch, 300);

  input.addEventListener('input', debouncedSearch);
  input.addEventListener('keydown', handleKeyDown);
  resultsList.addEventListener('click', handleItemClick);
});
