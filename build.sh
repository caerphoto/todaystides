#!/bin/bash
HASH=$(date +%Y%m%d%H%M%S)
BASE_FILENAME=page.$HASH
JS_FILENAME=$BASE_FILENAME.min.js
CSS_FILENAME=$BASE_FILENAME.css
JS_PATH=build/javascript
CSS_PATH=build/css
INPUT_JS=(
  assets/javascript/page.js
)
echo Minifying these files: "${INPUT_JS[@]}"

mkdir -p $JS_PATH
mkdir -p $CSS_PATH
rm $JS_PATH/*.js
rm $CSS_PATH/*.css

terser -m --warn "${INPUT_JS[@]}" > $JS_PATH/$JS_FILENAME &&
  echo $JS_PATH/$JS_FILENAME generated

cp assets/css/page.css $CSS_PATH/$CSS_FILENAME &&
  echo $CSS_PATH/$CSS_FILENAME created
