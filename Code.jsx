import React, { useState, useRef } from 'react';
import { Upload, Download } from 'lucide-react';

const GraphDataExtractor = () => {
  const [image, setImage] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [calibration, setCalibration] = useState({
    yMin: 0,
    yMax: 2000000,
    yMinPixel: null,
    yMaxPixel: null,
    xPositions: {}
  });
  const [step, setStep] = useState(1);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(event.target.result);
          imageRef.current = img;
          setTimeout(() => drawImage(img), 100);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const drawImage = (img) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (step === 2) {
      setCalibration(prev => ({ ...prev, yMaxPixel: y }));
      alert(`Top Y-axis point set at pixel ${Math.round(y)}`);
    } else if (step === 3) {
      setCalibration(prev => ({ ...prev, yMinPixel: y }));
      alert(`Bottom Y-axis point set at pixel ${Math.round(y)}`);
      setStep(4);
    }
  };

  const pixelToValue = (pixelY) => {
    const { yMin, yMax, yMinPixel, yMaxPixel } = calibration;
    if (yMinPixel === null || yMaxPixel === null) return 0;
    
    // Linear interpolation (note: pixel Y increases downward)
    const ratio = (pixelY - yMaxPixel) / (yMinPixel - yMaxPixel);
    return yMax - (ratio * (yMax - yMin));
  };

  const analyzeGraph = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Define color ranges for each category (RGB)
    const isBlue = (r, g, b) => b > 150 && b > r + 30 && b > g + 30;
    const isPurple = (r, g, b) => r > 100 && b > 100 && g < 150 && Math.abs(r - b) < 80;
    const isRed = (r, g, b) => r > 150 && g < 100 && b < 100;

    // Sample x-positions for each year
    const yearPositions = {
      "FY'15": Math.floor(canvas.width * 0.12),
      "FY'17": Math.floor(canvas.width * 0.20),
      "FY'19": Math.floor(canvas.width * 0.28),
      "FY'21": Math.floor(canvas.width * 0.36),
      "FY'23": Math.floor(canvas.width * 0.44),
      "FY'25": Math.floor(canvas.width * 0.52),
      "FY'27": Math.floor(canvas.width * 0.60),
      "FY'29": Math.floor(canvas.width * 0.68),
      "FY'31": Math.floor(canvas.width * 0.76),
      "FY'33": Math.floor(canvas.width * 0.84),
      "FY'35": Math.floor(canvas.width * 0.88),
      "FY'37": Math.floor(canvas.width * 0.92),
      "FY'39": Math.floor(canvas.width * 0.96)
    };

    const results = [];

    Object.entries(yearPositions).forEach(([year, x]) => {
      let topY = null;
      let redTopY = null;
      let purpleTopY = null;
      let blueTopY = null;

      // Scan from top to bottom
      for (let y = 0; y < canvas.height; y++) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (topY === null && (isRed(r, g, b) || isPurple(r, g, b) || isBlue(r, g, b))) {
          topY = y;
        }

        if (redTopY === null && isRed(r, g, b)) {
          redTopY = y;
        }
        if (purpleTopY === null && isPurple(r, g, b)) {
          purpleTopY = y;
        }
        if (blueTopY === null && isBlue(r, g, b)) {
          blueTopY = y;
        }
      }

      // Calculate values
      const total = Math.round(pixelToValue(topY || 0));
      const mdv = redTopY ? Math.round(pixelToValue(redTopY) - pixelToValue(topY || redTopY)) : 0;
      const lcv = purpleTopY ? Math.round(pixelToValue(purpleTopY) - pixelToValue(redTopY || purpleTopY)) : 0;
      const hdv = blueTopY ? Math.round(pixelToValue(blueTopY) - pixelToValue(purpleTopY || blueTopY)) : 0;

      results.push({
        year,
        hdv: Math.max(0, hdv),
        lcv: Math.max(0, lcv),
        mdv: Math.max(0, mdv),
        total: Math.max(0, total),
        type: year <= "FY'23" ? "Actual" : "Projected"
      });
    });

    setExtractedData(results);
    setStep(5);
  };

  const downloadCSV = () => {
    const headers = ['Year', 'Type', 'HDV', 'LCV', 'MDV', 'Total'];
    const csvContent = [
      headers.join(','),
      ...extractedData.map(row => 
        `${row.year},${row.type},${row.hdv},${row.lcv},${row.mdv},${row.total}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_truck_sales_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white">
      <h2 className="text-2xl font-bold mb-4">Accurate Graph Data Extractor</h2>
      
      <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200">
        <h3 className="font-semibold mb-2">Step {step} of 5</h3>
        {step === 1 && (
          <div>
            <p className="mb-3">Upload your graph image</p>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer w-fit">
              <Upload size={18} />
              Choose Image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {image && (
              <button
                onClick={() => setStep(2)}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Next: Calibrate Y-axis
              </button>
            )}
          </div>
        )}
        {step === 2 && (
          <p>Click on the TOP of the Y-axis (where it shows 2,000,000)</p>
        )}
        {step === 3 && (
          <p>Click on the BOTTOM of the Y-axis (where it shows 0)</p>
        )}
        {step === 4 && (
          <div>
            <p className="mb-3">Calibration complete! Adjust Y-axis range if needed:</p>
            <div className="flex gap-4 mb-3">
              <div>
                <label className="block text-sm mb-1">Y-axis Maximum:</label>
                <input
                  type="number"
                  value={calibration.yMax}
                  onChange={(e) => setCalibration(prev => ({ ...prev, yMax: parseInt(e.target.value) }))}
                  className="border rounded px-2 py-1 w-32"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Y-axis Minimum:</label>
                <input
                  type="number"
                  value={calibration.yMin}
                  onChange={(e) => setCalibration(prev => ({ ...prev, yMin: parseInt(e.target.value) }))}
                  className="border rounded px-2 py-1 w-32"
                />
              </div>
            </div>
            <button
              onClick={analyzeGraph}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Extract Data
            </button>
          </div>
        )}
        {step === 5 && (
          <div>
            <p className="text-green-700">✓ Data extraction complete!</p>
            <button
              onClick={downloadCSV}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Download size={18} />
              Download CSV
            </button>
          </div>
        )}
      </div>

      {image && (
        <div className="mb-6 border rounded overflow-hidden">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="max-w-full cursor-crosshair"
            style={{ display: 'block' }}
          />
        </div>
      )}

      {extractedData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Year</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                <th className="border border-gray-300 px-4 py-2 text-right">HDV</th>
                <th className="border border-gray-300 px-4 py-2 text-right">LCV</th>
                <th className="border border-gray-300 px-4 py-2 text-right">MDV</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {extractedData.map((row, idx) => (
                <tr key={idx} className={row.type === "Projected" ? "bg-blue-50" : ""}>
                  <td className="border border-gray-300 px-4 py-2">{row.year}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.type === "Actual" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{row.hdv.toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{row.lcv.toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{row.mdv.toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right font-semibold">{row.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GraphDataExtractor;
