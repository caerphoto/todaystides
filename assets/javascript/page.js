/*global CONFIG */
function $(selector) { return document.querySelector(selector); }
const $search = $('#station-name');
const $results = $('#found-stations');
const $tides = $('#tides');

let searchTimer = null;

function createResultItem(station) {
  const $li = document.createElement('li');
  const $btn = document.createElement('button');
  $li.classList.add('found-station');
  $li.dataset.id = station.Id;

  $btn.appendChild(document.createTextNode(station.Name));
  $btn.type = 'button';

  $li.appendChild($btn);
  return $li;
}

function renderStationSearchResults(stations) {
  const $frag = document.createDocumentFragment();
  $results.innerHTML = '';
  if (stations.length === 0) {
    $results.innerHTML = 'No results found.';
    return;
  }

  stations.forEach(station => $frag.appendChild(createResultItem(station)));
  $results.appendChild($frag);
}

function normalizeTideData(data) {
  const normalized = data.map(item => {
    item.DateTime = new Date(item.DateTime);
    item.EventType = item.EventType === 'HighWater' ? 'High' : 'Low';
    return item;
  });

  normalized.sort((a, b) => a.DateTime - b.DateTime);
  return normalized;
}

function pad(num) {
  return num < 10 ? '0' + num : num;
}

function renderTideData(data) {
  const $frag = document.createDocumentFragment();

  $tides.innerHTML = '';

  normalizeTideData(data).forEach(item => {
    const $p = document.createElement('p');
    const hour = pad(item.DateTime.getHours());
    const minute = pad(item.DateTime.getMinutes());
    const time = `${hour}:${minute}`;
    $p.appendChild(document.createTextNode(`${item.EventType}: ${time}`));
    $p.classList.add(item.EventType.toLowerCase());
    $frag.appendChild($p);
  });

  $tides.appendChild($frag);
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
  request(path).then(renderTideData);
});

$search.focus();
