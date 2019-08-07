/*global CONFIG */
function $(selector) { return document.querySelector(selector); }
const $search = $('#station-name');
const $results = $('#found-stations');
const $tides = $('#tides');
const $searching = $('#searching-spinner');
const $loadingTides = $('#tides-spinner');

const ONE_DAY = 1000 * 60 * 60 * 24;

let searchTimer = null;

function makeTitle(stationName) {
  return stationName + ' &middot; Today’s Tides';
}

function makeUrl(stationId) {
  return window.location.pathname + '?station=' + stationId;
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

function renderTidesLoading() {
  $tides.innerHTML = '<span class="loading-spinner loading"></span> Loading tide data&hellip;';
}

function renderHourMarkers() {
  const $frag = document.createDocumentFragment();
  const $box = createEl('div');
  $box.className = 'hour-markers';

  for (let i = 0; i < 24; i += 1) {
    const $marker = createEl('div');
    $marker.className = 'hour-marker';
    $marker.appendChild(document.createTextNode(i));
    $box.appendChild($marker);
  }
  $frag.appendChild($box);
  return $frag;
}

function dateAtMidnight(dateTime) {
  const newDate = new Date(dateTime);
  ['Hours', 'Minutes', 'Seconds', 'Milliseconds'].forEach(unit => {
    newDate['set' + unit](0);
  });
  return newDate;
}

function calculateWidth(index, items) {
  const midnight = dateAtMidnight(items[0].DateTime);
  const endOfDay = new Date(midnight);
  endOfDay.setHours(24);
  const thisTime = items[index].DateTime;
  const prevTime = index ? items[index - 1].DateTime : null;
  let size;

  size = thisTime - midnight;
  // for (let i = )

  const containerWidth = $tides.getBoundingClientRect().width;

  return ((size * 2) / ONE_DAY) * containerWidth + 'px';
}

function renderTideData(data, stationName) {
  const $frag = document.createDocumentFragment();
  const $info = createEl('h2');

  $tides.innerHTML = '';

  $info.appendChild(document.createTextNode(`Tide information for ${stationName}:`));
  $frag.appendChild($info);

  $frag.appendChild(renderHourMarkers());

  normalizeTideData(data).forEach((item, index, normalizedData) => {
    const $p = createEl('p');
    const hour = pad(item.DateTime.getHours());
    const minute = pad(item.DateTime.getMinutes());
    const time = `${hour}:${minute}`;

    if (item.EventType === 'High') $p.appendChild(createEl('br'));
    $p.appendChild(document.createTextNode(time));
    $p.classList.add(item.EventType.toLowerCase());
    $p.classList.add('water-mark');
    if (item.EventType === 'Low') $p.appendChild(createEl('br'));

    $p.style.width = calculateWidth(index, normalizedData);

    $frag.appendChild($p);
  });

  $frag.appendChild(renderHourMarkers());
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
  $searching.classList.add('loading');
  request(path).then(data => {
    $searching.classList.remove('loading');
    renderStationSearchResults(data);
  });
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
  renderTidesLoading();
  fetchTideData($li.dataset.id).then(tideData => {
    if (tideData.error) return alert(tideData.error);

    const historyData = {
      Name: $li.dataset.name,
      Id: $li.dataset.id,
      tideData: tideData
    };
    loadFromState(historyData);
    history.pushState(historyData, makeTitle($li.dataset.name), makeUrl($li.dataset.id));
  });
});

document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
});

window.addEventListener('popstate', (event) => {
  if (event.state) loadFromState(event.state);
});

if (history.state) loadFromState(history.state);

if (CONFIG.stationData && !history.state) {
  let data = CONFIG.stationData;

  fetchTideData(data.Id).then(tideData => {
    if (tideData.error) return alert(tideData.error);

    data.tideData = tideData;
    history.replaceState(data, makeTitle(data.Name), makeUrl(data.Id));
    loadFromState(data);
  });
}

$search.focus();
