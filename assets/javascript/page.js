/*global CONFIG */
function $(selector) { return document.querySelector(selector); }
const $search = $('#station-name');
const $results = $('#found-stations');
const $tides = $('#tides');
const $searching = $('#searching-spinner');
const $loadingTides = $('#tides-spinner');

const ONE_DAY = 1000 * 60 * 60 * 24;
const LABEL_SIZE = 30;
const QUADRATIC_WEIGHT = 60;

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

function dateAtMidnight(dateTime) {
  const newDate = new Date(dateTime);
  ['Hours', 'Minutes', 'Seconds', 'Milliseconds'].forEach(unit => {
    newDate['set' + unit](0);
  });
  return newDate;
}

function xFromTime(time, chartWidth) {
  const midnight = dateAtMidnight(time).getTime();
  const offset = time.getTime() - midnight;
  const padding = 20;
  return offset * ((chartWidth - LABEL_SIZE - padding) / ONE_DAY) + LABEL_SIZE + padding;
}

function yFromTide(tideHeight, chartHeight, maxHeight) {
  return chartHeight - (tideHeight * (chartHeight / maxHeight)) - LABEL_SIZE;
}

function renderChartAxes(ctx, yMax, chartHeight, chartWidth) {
  const time = dateAtMidnight(new Date());
  const xAxisStart = xFromTime(time, chartWidth);
  ctx.fillStyle = '#888';

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';

  // Y axis
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = `${LABEL_SIZE}px sans-serif`;
  for (let i = 0; i < yMax; i += 0.5) {
    const y = yFromTide(i, chartHeight, yMax);
    ctx.moveTo(xAxisStart, y);
    ctx.lineTo(chartWidth, y);
    ctx.fillText(i.toFixed(1), xAxisStart - 4, y);
  }

  // X axis
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ctx.font = `${LABEL_SIZE / 1.4}px sans-serif`;
  for (let hour = 0; hour < 24; hour += 1) {
    time.setHours(hour);
    const x = xFromTime(time, chartWidth);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, chartHeight - LABEL_SIZE);
    ctx.fillText(pad(hour), x, chartHeight + 4);
  }

  ctx.stroke();
}

function renderLabel(ctx, text, x, y, size) {
  const textWidth = ctx.measureText(text).width + 6;
  const boundX = Math.max(x, textWidth / 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(boundX - textWidth / 2, y, textWidth, size);
  ctx.fillStyle = '#444';
  ctx.fillText(text, boundX, y + 2);
}

function getLabelText(height, time) {
  const hour = pad(time.getHours());
  const minute = pad(time.getMinutes());
  return `${height.toFixed(2)}m @ ${hour}:${minute}`;
}

function renderTick(ctx, x, y, isLow) {
  const tickSize = LABEL_SIZE / 1.4;
  if (isLow) {
    ctx.moveTo(x, y - tickSize);
    ctx.lineTo(x, y);
  } else {
    ctx.moveTo(x, y + tickSize);
    ctx.lineTo(x, y);
  }
}

function prepareContextForChart(ctx) {
  ctx.beginPath();
  ctx.strokeStyle = '#8af';
  ctx.font = `${LABEL_SIZE}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 2;
}

function renderChart($canvas, data) {
  const ctx = $canvas.getContext('2d');
  const rect = $canvas.getBoundingClientRect();
  const width = rect.width * 2;
  const height = rect.height * 2;
  const maxHeight = Math.max.apply(null, data.map(item => item.Height));
  const chartYMax = maxHeight - Math.floor(maxHeight) > 0.5 ?
    Math.ceil(maxHeight) + 0.5 : Math.ceil(maxHeight);
  const fontSize = LABEL_SIZE;
  let prevX, prevY;

  $canvas.classList.add('tide-chart');
  $canvas.width = width;
  $canvas.height = height;

  ctx.font = fontSize + 'px sans-serif';
  ctx.clearRect(0, 0, width, height);

  renderChartAxes(ctx, chartYMax, height, width);

  prepareContextForChart(ctx);
  data.forEach((item, index) => {
    const x = xFromTime(item.DateTime, width);
    const y = yFromTide(item.Height, height, chartYMax);
    const label = getLabelText(item.Height, item.DateTime);
    const isLow = item.EventType === 'Low';

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.bezierCurveTo(
        prevX + QUADRATIC_WEIGHT, prevY,
        x - QUADRATIC_WEIGHT, y,
        x, y
      );
    }

    renderTick(ctx, x, y, isLow);
    if (isLow) {
      renderLabel(ctx, label, x, y + 2, fontSize);
    } else {
      renderLabel(ctx, label, x, y - fontSize - 6, fontSize);
    }

    prevX = x;
    prevY = y;
  });
  ctx.stroke();

  return $canvas;
}


function renderTideData(data, stationName) {
  const $frag = document.createDocumentFragment();
  const $info = createEl('h2');
  const $chart = createEl('canvas');
  const $axisLabel = createEl('p');

  $tides.innerHTML = '';

  $info.appendChild(document.createTextNode(`Tide height (m) for ${stationName}:`));
  $frag.appendChild($info);
  $frag.appendChild($chart);
  $axisLabel.appendChild(document.createTextNode('Time'));
  $axisLabel.classList.add('axis-label');
  $frag.appendChild($axisLabel);

  $tides.appendChild($frag);
  renderChart($chart, normalizeTideData(data));
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

if (history.state) {
  loadFromState(history.state);
} else if (CONFIG.stationData) {
  let data = CONFIG.stationData;

  fetchTideData(data.Id).then(tideData => {
    if (tideData.error) return alert(tideData.error);

    data.tideData = tideData;
    history.replaceState(data, makeTitle(data.Name), makeUrl(data.Id));
    loadFromState(data);
  });
}

$search.focus();
