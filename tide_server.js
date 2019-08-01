const BASE_API_PATH = '/uktidalapi/api/V1/Stations';
const TIDE_API_PATH = '/**STATION_ID**/TidalEvents?duration=1';

const HTTPS = require('https');
const API_REQUEST_OPTIONS = {
  hostname: 'admiraltyapi.azure-api.net',
  method: 'GET',
  headers: {
    'Ocp-Apim-Subscription-Key': ''
  }
};

function getStations(callback) {
  const reqOptions = Object.assign(
    {},
    API_REQUEST_OPTIONS,
    { path: BASE_API_PATH }
  );
  const request = HTTPS.request(reqOptions, (response) => {
    let resData = '';
    response.on('data', (data) => resData += data);
    response.on('end', () => callback(JSON.parse(resData)));
  });

  request.end();
}

getStations(stationList => {
  console.log(stationList);
});
