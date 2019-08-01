const FS = require('fs');
const PATH = require('path');
const BASE_API_PATH = '/uktidalapi/api/V1/Stations';
const TIDE_API_PATH = '/**STATION_ID**/TidalEvents?duration=1';

const SECRETS = JSON.parse(FS.readFileSync('secrets.json', { encoding: 'utf8' }));
const AUTH_KEY = SECRETS.primary_key;

const HTTPS = require('https');
const API_REQUEST_OPTIONS = {
  hostname: 'admiraltyapi.azure-api.net',
  method: 'GET',
  rejectUnauthorized: false, // yes it's bad but there's no other way for me
  headers: {
    'Ocp-Apim-Subscription-Key': AUTH_KEY
  }
};

const URL = require('url');
const MIME = require('mime-types');

function request(path) {
  return new Promise(resolve => {
    const reqOptions = Object.assign(
      {},
      API_REQUEST_OPTIONS,
      { path: path }
    );
    const request = HTTPS.request(reqOptions, (response) => {
      let resData = '';
      response.on('data', (data) => resData += data);
      response.on('end', () => resolve(JSON.parse(resData)));
    });

    request.end();
  });
}

function sortByName(a, b) {
  return a.Name.localeCompare(b.Name, { sensitivity: 'base' });
}

function simplifiedStationsData(data) {
  return data.features.map((feature) => feature.properties);
}

function organizeStations(stationData) {
  const basicData = simplifiedStationsData(stationData);
  const countries = basicData.reduce((obj, station) => {
    const c = station.Country;
    if (obj[c]) {
      obj[c].push(station);
    } else {
      obj[c] = [station];
    }
    return obj;
  }, {});

  Object.values(countries).forEach(country => country.sort(sortByName));

  return countries;
}

function normalizeTideData(tideData) {
  return tideData.map(td => {
    td.DateTime = new Date(td.DateTime);
    return td;
  });
}

function requestStationsData(name) {
  if (name) return request(BASE_API_PATH + '?name=' + name);
  return request(BASE_API_PATH);
}

async function requestTideData(stationId) {
  const data = await request(BASE_API_PATH + TIDE_API_PATH.replace('**STATION_ID**', stationId));
  return normalizeTideData(data);
}

async function getGroupedStations() {
  return organizeStations(await requestStationsData());
}

async function findStation(stationName) {
  const stationsData = await requestStationsData(stationName);
  const simplifiedData = simplifiedStationsData(stationsData);
  simplifiedData.sort(sortByName);
  return simplifiedData;
}

async function getTides(stationId) {
  return await requestTideData(stationId);
}

async function fetchAsset(path, response) {
  const stream = FS.createReadStream(path);
  const contentType = MIME.contentType(PATH.extname(path)) || 'application/octet-stream';
  response.setHeader('Content-Type', contentType);
  stream.on('error', () => render404(response, path));
  stream.on('readable', () => stream.pipe(response));
  stream.on('end', () => console.log(' > Served asset', path));
}

function fetchPage(response) {
  return FS.createReadStream('page.html', { encoding: 'utf8' }).pipe(response);
}

async function render404(response, notFoundPath) {
  console.log(' ! Unable to find', notFoundPath);
  response.statusCode = 404;
  response.end('Not found');
}

function requestDispatcher(request, response) {
  const url = URL.parse(request.url, true);
  const path = url.href;

  console.log('Serving URL', path);

  response.statusCode = 200;

  switch (true) {
    case path === '/':
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      fetchPage(response);
      break;
    case /^\/assets\//.test(path):
      fetchAsset('.' + url.pathname, response);
      break;
    case /^\/find_station/.test(path):
      findStation(url.query.name).then(stations => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(stations));
      });
      break;
    case /^\/tides/.test(path):
      getTides(url.query.id).then(data => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(data));
      });
      break;
    default:
      render404(response, path);
  }
}

require('http').createServer(function (request, response) {
  request.addListener('end', () => requestDispatcher(request, response)).resume();
}).listen('4000', '0.0.0.0');

/*
findLocal('gorles').then(stations => {
  const first = stations[0];
  console.log(first.Name, first.Id);
  return getTides(first.Id);
}).then(tides => {
  console.log(tides);
});
*/
