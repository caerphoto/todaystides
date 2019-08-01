/*global CONFIG */
function $(selector) { return document.querySelector(selector); }
const $search = $('#station-name');
const $results = $('#found-stations');
const $tides = $('#tides');

let searchTimer = null;

function createEl(elementType) {
  return document.createElement(elementType);
}

function createResultItem(station) {
  const $li = createEl('li');
  const $btn = createEl('button');
  $li.classList.add('found-station');
  $li.dataset.id = station.Id;
  $li.dataset.name = station.Name;

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

function renderTideData(data, stationName) {
  const $frag = document.createDocumentFragment();
  const $info = createEl('h2');

  $tides.innerHTML = '';

  $info.appendChild(document.createTextNode(`Tide information for ${stationName}:`));
  $frag.appendChild($info);

  normalizeTideData(data).forEach(item => {
    const $p = createEl('p');
    const hour = pad(item.DateTime.getHours());
    const minute = pad(item.DateTime.getMinutes());
    const time = `${hour}:${minute}`;

    if (item.EventType === 'High') $p.appendChild(createEl('br'));
    $p.appendChild(document.createTextNode(time));
    $p.classList.add(item.EventType.toLowerCase());
    if (item.EventType === 'Low') $p.appendChild(createEl('br'));

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
  request(path).then(data => {
    renderTideData(data, $li.dataset.name);
  });
});

$search.focus();
