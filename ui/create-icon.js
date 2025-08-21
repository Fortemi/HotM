#!/usr/bin/env node

// Cross-platform icon generation script
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple PNG creation (minimal implementation)
// For production, you'd want to use a library like sharp or jimp
function createSimplePNG(size) {
    // PNG header
    const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // Create a simple blue square with white H
    const width = size;
    const height = size;
    
    // IHDR chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type (RGBA)
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    
    // Create image data (simplified - blue background with white H)
    const imageData = [];
    for (let y = 0; y < height; y++) {
        imageData.push(0); // filter type none
        for (let x = 0; x < width; x++) {
            // Simple H pattern
            const inH = 
                (x >= width * 0.25 && x <= width * 0.35 && y >= height * 0.2 && y <= height * 0.8) || // Left vertical
                (x >= width * 0.65 && x <= width * 0.75 && y >= height * 0.2 && y <= height * 0.8) || // Right vertical
                (x >= width * 0.25 && x <= width * 0.75 && y >= height * 0.45 && y <= height * 0.55); // Horizontal
            
            if (inH) {
                // White
                imageData.push(255, 255, 255, 255);
            } else {
                // Blue gradient
                const gradient = Math.floor(y / height * 50);
                imageData.push(41 + gradient, 128 + gradient, 185 + gradient, 255);
            }
        }
    }
    
    // Compress with zlib
    const compressed = zlib.deflateSync(Buffer.from(imageData));
    
    // Create chunks
    function createChunk(type, data) {
        const chunk = Buffer.concat([
            Buffer.from(type),
            data
        ]);
        const crc = crc32(chunk);
        return Buffer.concat([
            Buffer.alloc(4).fill(data.length),
            chunk,
            Buffer.alloc(4).fill(crc)
        ]);
    }
    
    // Simple CRC32 (would use a library in production)
    function crc32(buf) {
        let crc = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            crc = (crc >>> 8) ^ buf[i];
        }
        return ~crc;
    }
    
    // Build PNG
    const ihdrChunk = createChunk('IHDR', ihdr);
    const idatChunk = createChunk('IDAT', compressed);
    const iendChunk = createChunk('IEND', Buffer.alloc(0));
    
    return Buffer.concat([PNG_SIGNATURE, ihdrChunk, idatChunk, iendChunk]);
}

// Ensure icons directory exists
const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating HotM icons...');

// For now, just copy a placeholder message
// In production, you'd use a proper image library
const sizes = [32, 128, 256];

// Create a simple blue icon file as placeholder
sizes.forEach(size => {
    const filename = path.join(iconsDir, `${size}x${size}.png`);
    
    // Create a simple blue square (this is a valid 1x1 PNG)
    // In production, use sharp, jimp, or canvas to create proper icons
    const simplePNG = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR length
        0x49, 0x48, 0x44, 0x52, // "IHDR"
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, etc.
        0x1F, 0x15, 0xC4, 0x89, // CRC
        0x00, 0x00, 0x00, 0x0D, // IDAT length
        0x49, 0x44, 0x41, 0x54, // "IDAT"
        0x78, 0x9C, 0x62, 0x2A, 0x98, 0xB9, 0xF1, 0x0D, 0x00, // compressed blue pixel
        0x03, 0xCC, 0x01, 0x71, // more data
        0x55, 0xF7, 0xDE, 0xE3, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4E, 0x44, // "IEND"
        0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    
    if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, simplePNG);
        console.log(`Created placeholder: ${filename}`);
    }
});

// Create special sizes
if (!fs.existsSync(path.join(iconsDir, '128x128@2x.png'))) {
    fs.copyFileSync(
        path.join(iconsDir, '256x256.png'),
        path.join(iconsDir, '128x128@2x.png')
    );
}

if (!fs.existsSync(path.join(iconsDir, 'icon.png'))) {
    fs.copyFileSync(
        path.join(iconsDir, '256x256.png'),
        path.join(iconsDir, 'icon.png')
    );
}

console.log('Note: For production icons, run create-icon.ps1 on Windows');
console.log('or install an image processing library like sharp or jimp');