/*global CONFIG */
function $(selector) { return document.querySelector(selector); }
const $search = $('#station-name');
const $results = $('#found-stations');

let searchTimer = null;

function renderStationSearchResults(stations) {
  const $frag = document.createDocumentFragment();
  $results.innerHTML = '';
  if (stations.length === 0) {
    $results.innerHTML = 'No results found.';
    return;
  }

  stations.forEach(station => {
    const $li = document.createElement('li');
    const $btn = document.createElement('button');
    $li.classList.add('found-station');
    $li.dataset.id = station.Id;

    $btn.appendChild(document.createTextNode(station.Name));
    $btn.type = 'button';

    $li.appendChild($btn);
    $frag.appendChild($li);
  });
  $results.appendChild($frag);
}

function request(path) {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', path);
    xhr.responseType = 'json';
    xhr.addEventListener('load', () => {
      resolve(xhr.response);
    });
    xhr.send();
  });
}

function findStations(name) {
  const path = CONFIG.searchPath + encodeURIComponent(name);
  request(path).then(renderStationSearchResults);
}

$search.addEventListener('input', (event) => {
  const searchTerm = event.target.value;

  clearTimeout(searchTimer);

  if (searchTerm.length < 3) return;

  searchTimer = setTimeout(() => {
    if (searchTerm) findStations(searchTerm);
  }, 750);
});

$results.addEventListener('click', (event) => {
  const $li = event.target.closest('li.found-station');
  const path = CONFIG.tideDataPath + $li.dataset.id;
  request(path).then(data => {
    console.table(data);
  });
});

$search.focus();
