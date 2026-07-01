import { jsPDF } from 'jspdf';

/**
 * Generate a professional multi-page PDF report for the blade design.
 *
 * @param {Object} bladeParams - Blade design parameters
 * @param {number} windSpeed - Operating wind speed (m/s)
 * @param {number} tsr - Tip speed ratio
 * @param {Object} bemResults - BEM solver results
 * @param {Array} powerCurve - Power curve data array
 */
export function exportPDF(bladeParams, windSpeed, tsr, bemResults, powerCurve) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const R = bladeParams.radiusMm / 1000;
  const omega = (tsr * windSpeed) / R;
  const rpm = (omega * 60) / (2 * Math.PI);

  // ─── Helper Functions ───
  function drawHeader(title, pageNum) {
    // Top accent line
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // Page title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, 22);

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, 27, pageWidth - margin, 27);

    // Page number
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    doc.text('AeroBlade Pro Report', margin, pageHeight - 10);
  }

  function drawTableRow(y, cols, widths, isHeader = false, isAlt = false) {
    const rowHeight = 7;

    if (isHeader) {
      doc.setFillColor(240, 249, 255);
      doc.rect(margin, y - 4.5, contentWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(2, 132, 199);
    } else if (isAlt) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 4.5, contentWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
    }

    let x = margin;
    cols.forEach((col, i) => {
      doc.text(String(col), x + 2, y);
      x += widths[i];
    });

    return y + rowHeight;
  }

  function drawKVRow(y, label, value) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(String(value), margin + 70, y);
    return y + 7;
  }

  function drawSectionTitle(y, title) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text(title, margin, y);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    return y + 10;
  }

  // ═══════════════════════════════════════════════════
  // PAGE 1 — Cover
  // ═══════════════════════════════════════════════════
  // Background accent
  doc.setFillColor(2, 132, 199);
  doc.rect(0, 0, pageWidth, 90, 'F');

  // Gradient overlay
  doc.setFillColor(3, 105, 161);
  doc.rect(0, 70, pageWidth, 20, 'F');

  // Title
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('AeroBlade Pro', margin, 40);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(186, 230, 253);
  doc.text('Wind Turbine Blade Design Report', margin, 52);

  // Date
  doc.setFontSize(11);
  doc.setTextColor(125, 211, 252);
  doc.text(new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), margin, 64);

  // Summary box
  let y = 105;
  y = drawSectionTitle(y, 'Design Overview');

  y = drawKVRow(y, 'Blade Length (R)', `${R.toFixed(2)} m`);
  y = drawKVRow(y, 'Rotor Diameter', `${(R * 2).toFixed(2)} m`);
  y = drawKVRow(y, 'Number of Segments', `${bladeParams.numSegments}`);
  y = drawKVRow(y, 'Planform Shape', bladeParams.planform === 'optimized' ? 'Optimized Curve' : 'Linear Taper');
  y = drawKVRow(y, 'Mid-Span Position', `${((bladeParams.midPosition ?? 0.5) * 100).toFixed(0)}% of span`);

  y += 10;
  y = drawSectionTitle(y, 'Operating Conditions');

  y = drawKVRow(y, 'Wind Speed', `${windSpeed} m/s`);
  y = drawKVRow(y, 'Tip Speed Ratio (λ)', `${tsr}`);
  y = drawKVRow(y, 'Rotational Speed', `${rpm.toFixed(1)} RPM`);

  y += 10;
  y = drawSectionTitle(y, 'Performance Summary');

  y = drawKVRow(y, 'Estimated Power', `${(bemResults.totalPower / 1000).toFixed(2)} kW`);
  y = drawKVRow(y, 'Power Coefficient (Cp)', `${bemResults.cp.toFixed(4)}`);
  y = drawKVRow(y, 'Total Thrust', `${(bemResults.totalThrust / 1000).toFixed(2)} kN`);
  y = drawKVRow(y, 'Betz Limit', '0.5926 (theoretical max)');

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated by AeroBlade Pro — Blade Element Momentum Analysis', margin, pageHeight - 10);

  // ═══════════════════════════════════════════════════
  // PAGE 2 — Design Parameters
  // ═══════════════════════════════════════════════════
  doc.addPage();
  drawHeader('Design Parameters', 2);

  y = 38;
  y = drawSectionTitle(y, 'Regional Blade Properties');

  const regionHeaders = ['Region', 'Airfoil', 'Chord (mm)', 'Twist (°)', 'Thickness (%)'];
  const regionWidths = [30, 40, 30, 25, 30];

  y = drawTableRow(y, regionHeaders, regionWidths, true);

  const regionData = [
    ['Root', bladeParams.root.airfoil, bladeParams.root.chordMm, bladeParams.root.twistDeg, bladeParams.root.thicknessPct],
    ['Mid-Span', bladeParams.mid.airfoil, bladeParams.mid.chordMm, bladeParams.mid.twistDeg, bladeParams.mid.thicknessPct],
    ['Tip', bladeParams.tip.airfoil, bladeParams.tip.chordMm, bladeParams.tip.twistDeg, bladeParams.tip.thicknessPct],
  ];

  regionData.forEach((row, i) => {
    y = drawTableRow(y, row, regionWidths, false, i % 2 === 1);
  });

  y += 15;
  y = drawSectionTitle(y, 'Design Notes');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);

  const notes = [
    '• Chord and twist values are interpolated between regions using ' +
      (bladeParams.planform === 'optimized' ? 'cosine (smooth)' : 'linear') + ' interpolation.',
    `• Mid-span transition occurs at ${((bladeParams.midPosition ?? 0.5) * 100).toFixed(0)}% of blade span (${((bladeParams.midPosition ?? 0.5) * R).toFixed(2)} m from root).`,
    `• BEM analysis uses ${bladeParams.numSegments} discrete blade elements with Prandtl tip-loss correction.`,
    '• Glauert high-induction correction is applied for axial induction factors above 0.33.',
  ];

  notes.forEach((note) => {
    const lines = doc.splitTextToSize(note, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  });

  // ═══════════════════════════════════════════════════
  // PAGE 3 — BEM Results (Segment Data)
  // ═══════════════════════════════════════════════════
  doc.addPage();
  drawHeader('BEM Analysis Results', 3);

  y = 38;
  y = drawSectionTitle(y, 'Per-Segment Aerodynamic Data');

  const segHeaders = ['Seg', 'r (m)', 'r/R', 'Chord (m)', 'Twist (°)', 'α (°)', 'Cl', 'Cd', 'L/D'];
  const segWidths = [14, 18, 16, 22, 18, 16, 16, 16, 18];

  y = drawTableRow(y, segHeaders, segWidths, true);

  bemResults.segments.forEach((seg, i) => {
    const ld = seg.cd > 0 ? (seg.cl / seg.cd).toFixed(1) : '—';
    const row = [
      i + 1,
      seg.r.toFixed(2),
      (seg.r / R).toFixed(3),
      seg.chord.toFixed(3),
      seg.twistDeg.toFixed(1),
      seg.alphaDeg.toFixed(1),
      seg.cl.toFixed(3),
      seg.cd.toFixed(4),
      ld,
    ];
    y = drawTableRow(y, row, segWidths, false, i % 2 === 1);

    // Check if we need a new page
    if (y > pageHeight - 25) {
      doc.addPage();
      drawHeader('BEM Analysis Results (continued)', 4);
      y = 38;
      y = drawTableRow(y, segHeaders, segWidths, true);
    }
  });

  // ═══════════════════════════════════════════════════
  // PAGE 4 — Power Curve
  // ═══════════════════════════════════════════════════
  doc.addPage();
  drawHeader('Power Curve Analysis', doc.internal.pages.length - 1);

  y = 38;
  y = drawSectionTitle(y, 'Power Output vs Wind Speed');

  const pcHeaders = ['Wind (m/s)', 'Power (kW)', 'Cp', 'Efficiency (%)'];
  const pcWidths = [35, 40, 35, 40];

  y = drawTableRow(y, pcHeaders, pcWidths, true);

  powerCurve.forEach((pt, i) => {
    const efficiency = ((pt.cp / 0.5926) * 100).toFixed(1);
    const row = [
      pt.windSpeed,
      pt.power.toFixed(2),
      pt.cp.toFixed(4),
      `${efficiency}%`,
    ];
    y = drawTableRow(y, row, pcWidths, false, i % 2 === 1);
  });

  y += 12;
  y = drawSectionTitle(y, 'Key Observations');

  // Find peak power and peak Cp
  const peakPower = powerCurve.reduce((max, pt) => pt.power > max.power ? pt : max, powerCurve[0]);
  const peakCp = powerCurve.reduce((max, pt) => pt.cp > max.cp ? pt : max, powerCurve[0]);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);

  const observations = [
    `• Peak power output: ${peakPower.power.toFixed(2)} kW at ${peakPower.windSpeed} m/s wind speed.`,
    `• Maximum Cp: ${peakCp.cp.toFixed(4)} at ${peakCp.windSpeed} m/s (${((peakCp.cp / 0.5926) * 100).toFixed(1)}% of Betz limit).`,
    `• Current operating point: ${windSpeed} m/s produces ${(bemResults.totalPower / 1000).toFixed(2)} kW with Cp = ${bemResults.cp.toFixed(4)}.`,
  ];

  observations.forEach((obs) => {
    const lines = doc.splitTextToSize(obs, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  });

  // ─── Save ───
  doc.save(`AeroBlade_Report_${Date.now()}.pdf`);
}
