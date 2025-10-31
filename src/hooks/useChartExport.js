import { useCallback } from 'react';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const serializeSvg = (svg, { backgroundColor } = {}) => {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (backgroundColor) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', backgroundColor);
    clone.insertBefore(rect, clone.firstChild);
  }
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
};

const svgToPngBlob = (svgText, width, height) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('No se pudo generar la imagen'));
          }
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });

export const useChartExport = () => {
  return useCallback(async (node, { filename = 'chart.png', backgroundColor } = {}) => {
    if (!node) return;
    const svg = node.querySelector('svg');
    if (!svg) return;
    const { width, height } = svg.getBoundingClientRect();
    const svgText = serializeSvg(svg, { backgroundColor });
    if (filename.endsWith('.svg')) {
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      downloadBlob(blob, filename);
      return;
    }
    const blob = await svgToPngBlob(svgText, Math.ceil(width), Math.ceil(height));
    downloadBlob(blob, filename);
  }, []);
};
