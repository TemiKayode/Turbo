/**
 * Crop the Turbo avatar icon out of the main logo artwork.
 *
 * Usage:
 *   node scripts/extract-avi.js
 */

const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const sharp = require(path.join(PROJECT_ROOT, 'frontend', 'node_modules', 'sharp'));
const SOURCE = path.join(PROJECT_ROOT, 'frontend', 'public', 'turbo-logo.png');
const OUTPUT = path.join(PROJECT_ROOT, 'frontend', 'public', 'turbo-avi.png');

async function run() {
  try {
    // The source artwork is 768x768. The avatar lives on the right side.
    // Crop a 230x230 square centred on the existing avatar graphic,
    // then resize down to 192x192 for crisp usage in the UI.
    await sharp(SOURCE)
      .extract({ left: 480, top: 280, width: 230, height: 230 })
      .resize(192, 192, { fit: 'cover' })
      .toFile(OUTPUT);

    console.log(`✓ Saved Turbo avatar to ${path.relative(PROJECT_ROOT, OUTPUT)}`);
  } catch (err) {
    console.error('Failed to generate avatar:', err);
    process.exit(1);
  }
}

run();

