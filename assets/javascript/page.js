/*global CONFIG */
function $(selector) { return document.querySelector(selector); }
const $search = $('#station-name');
const $results = $('#found-stations');
const $tides = $('#tides');

let searchTimer = null;

function makeTitle(stationName) {
  return stationName + ' &middot; Today’s Tides';
}

function makeUrl(stationId) {
  return '/?station=' + stationId;
}

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
    const date = new Date(item.DateTime);
    const type = item.EventType === 'HighWater' ? 'High' : 'Low';
    return Object.assign({}, item, {
      DateTime: date,
      EventType: type
    });
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

function fetchTideData(id) {
  return new Promise(resolve => {
    const path = CONFIG.tideDataPath + id;
    request(path).then(data => {
      resolve(data);
    });
  });
}

function loadFromState(state) {
  window.title = makeTitle(state.Name);
  renderTideData(state.tideData, state.Name);
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
  fetchTideData($li.dataset.id).then(tideData => {
    if (tideData.error) return alert(tideData.error);

    const historyData = {
      Name: $li.dataset.name,
      Id: $li.dataset.id,
      tideData: tideData
    };
    renderTideData(tideData, $li.dataset.name);
    history.pushState(historyData, $li.dataset.name, '/?station=' + $li.dataset.id);
  });
});

window.addEventListener('popstate', (event) => {
  if (event.state) loadFromState(event.state);
});

if (history.state) loadFromState(history.state);

if (CONFIG.stationData) {
  let data = CONFIG.stationData;

  fetchTideData(data.Id).then(tideData => {
    if (tideData.error) return alert(tideData.error);

    data.tideData = tideData;
    history.replaceState(data, makeTitle(data.Name), makeUrl(data.Id));
    loadFromState(data);
  });
}

$search.focus();
