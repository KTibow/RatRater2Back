import { createCanvas, loadImage } from "canvas";
import fs from "fs";

// Configuration
const frameCount = (60 * 3) / 10; // Number of frames
const outputDirectory = "frames"; // Output directory for frames

if (!fs.existsSync(outputDirectory)) {
  fs.mkdirSync(outputDirectory);
}

const logo = await loadImage("clover.svg");
// Draw each frame
for (let i = 1; i <= frameCount; i++) {
  const canvas = createCanvas(320, 320);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 320 * 0.5, 320 * 0.5);
  ctx.rotate((i / frameCount / 10) * Math.PI * 2);
  ctx.drawImage(logo, 320 * -0.5, 320 * -0.5, 320, 320);

  // Save the frame as a PNG image
  const outputFilename = `${outputDirectory}/${i}.png`;
  const out = fs.createWriteStream(outputFilename);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  console.log(`Frame ${i} generated: ${outputFilename}`);
}
