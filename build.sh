#!/bin/bash
HASH=$(date +%Y%m%d%H%M%S)
BASE_FILENAME=page.$HASH
JS_FILENAME=$BASE_FILENAME.js
CSS_FILENAME=$BASE_FILENAME.css
JS_PATH=build/javascript
CSS_PATH=build/css

mkdir -p $JS_PATH
mkdir -p $CSS_PATH
rm $JS_PATH/*.js
rm $CSS_PATH/*.css

cp assets/javascript/page.js $JS_PATH/$JS_FILENAME &&
  echo $JS_PATH/$JS_FILENAME created

cp assets/css/page.css $CSS_PATH/$CSS_FILENAME &&
  echo $CSS_PATH/$CSS_FILENAME created
