/*eslint no-console: "off" */
const FS = require('fs');
const PATH = require('path');

const MODE =process.env.MODE;
if (!MODE) {
  console.error('No environment mode specified. Specify MODE as either "production" or "development"');
  process.exit(1);
}
const CONFIG = JSON.parse(FS.readFileSync('config.json', { encoding: 'utf8' }))[MODE];
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
      response.on('end', () => {
        try {
          resolve(JSON.parse(resData));
        } catch (err) {
          resolve(null);
        }
      });
    });

    request.on('error', () => {
      resolve(null);
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
  if (data === null) return { error: 'Too many requests. Please try again in 20 seconds.' };
  return normalizeTideData(data);
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

async function getStationData(stationId) {
  if (!stationId) return null;
  const rawData = await request(BASE_API_PATH + '/' + stationId);

  return {
    Name: rawData.properties.Name,
    Id: rawData.properties.Id
  };
}

function fetchAsset(path, response) {
  const contentType = MIME.contentType(PATH.extname(path)) || 'application/octet-stream';
  response.setHeader('Content-Type', contentType);

  const stream = FS.createReadStream(path);
  stream.on('error', () => render404(response, path));
  stream.on('data', (data) => response.write(data));
  stream.on('end', () => {
    response.end();
    console.log(' > Served asset', path);
  });
}

function fetchPage(response, stationId) {
  return new Promise(resolve => {
    FS.readFile('page.html', { encoding: 'utf8' }, (err, pageText) => {
      if (err) {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.statuscode = 500;
        return resolve('HTTP 500: Server error');
      }

      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      pageText = pageText.replace(/#BASE_PATH#/g, CONFIG.basePath);
      pageText = pageText.replace(/#CSS-HASH#/g, CONFIG.assetHashes.css || '');
      pageText = pageText.replace(/#JS-HASH#/g, CONFIG.assetHashes.js || '');

      getStationData(stationId).then(stationData => {
        pageText = pageText.replace('#STATION_DATA#', JSON.stringify(stationData));
        resolve(pageText);
      });
    });
  });
}

async function render404(response, notFoundPath) {
  console.log(' ! Unable to find', notFoundPath);
  response.statusCode = 404;
  response.end('Not found');
}

function initAssetHashes() {
  if (MODE === 'development') {
    CONFIG.assetHashes = {
      css: '',
      js: ''
    };
  } else {
    const cssName = FS.readdirSync('build/css')[0];
    const jsName = FS.readdirSync('build/javascript')[0];
    CONFIG.assetHashes = {
      css: cssName.match(/(\.\d+)\.css/)[1],
      js: jsName.match(/(\.\d+)\.js/)[1]
    };
  }
}

function requestDispatcher(request, response) {
  const url = URL.parse(request.url, true);
  let path = url.pathname;
  let href = url.href;
  const pathRemap = new RegExp('^' + CONFIG.basePath);

  response.statusCode = 200;

  path = path.replace(pathRemap, '') || '/';
  href = href.replace(pathRemap, '') || '/';
  console.log('Serving URL:', href);

  switch (true) {
    case path === '/':
      fetchPage(response, url.query.station).then(responseText => {
        response.end(responseText);
        console.log(' > Served page.html');
      });
      break;
    case /^\/assets\/.*/.test(path):
      fetchAsset('.' + path, response);
      break;
    case /^\/find_station/.test(path):
      findStation(url.query.name).then(stations => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(stations));
        console.log(` > Served results for search "${url.query.name}"`);
      });
      break;
    case /^\/tides/.test(path):
      getTides(url.query.id).then(data => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(data));
        console.log(` > Served tide data station ID "${url.query.id}"`);
      });
      break;
    default:
      render404(response, href);
  }
}

initAssetHashes();

require('http').createServer(function (request, response) {
  request.addListener('end', () => requestDispatcher(request, response)).resume();
}).listen(CONFIG.listenPort, CONFIG.listenIp);

console.log(`Running in ${MODE} with base path ${CONFIG.basePath}`);
console.log(`Listening to ${CONFIG.listenIp} on port ${CONFIG.listenPort} ...`);
