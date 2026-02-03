import fs from 'fs';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import Converter from 'openapi-to-postmanv2';
import { swaggerOptions } from '../src/swaggerConfig';

const OUTPUT_DIR = path.join(__dirname, '..');
const OPENAPI_FILE = path.join(OUTPUT_DIR, 'openapi.json');
const POSTMAN_FILE = path.join(OUTPUT_DIR, 'postman_collection.json');

async function generateDocs() {
  console.log('Generating OpenAPI Specification...');
  const openapiSpec = swaggerJsdoc(swaggerOptions);
  
  fs.writeFileSync(OPENAPI_FILE, JSON.stringify(openapiSpec, null, 2));
  console.log(`OpenAPI Spec written to ${OPENAPI_FILE}`);

  console.log('Generating Postman Collection...');
  Converter.convert({ type: 'string', data: JSON.stringify(openapiSpec) },
    {},
    (err, conversionResult) => {
      if (err) {
        console.error('Conversion error:', err);
        process.exit(1);
      }
      if (!conversionResult || !conversionResult.result) {
        console.error('Could not convert', conversionResult?.reason);
        process.exit(1);
      } else {
        const postmanCollection = conversionResult.output?.[0]?.data;
        if (!postmanCollection) {
           console.error('Conversion succeeded but output data is missing');
           process.exit(1);
        }
        fs.writeFileSync(POSTMAN_FILE, JSON.stringify(postmanCollection, null, 2));
        console.log(`Postman Collection written to ${POSTMAN_FILE}`);
      }
    }
  );
}

generateDocs().catch(err => {
  console.error(err);
  process.exit(1);
});
