"use strict";
const fs = require("fs");
const path = require("path");
const out = __dirname;
const p = { crankRadius_m: 0.04, rodLength_m: 0.16, sliderMass_kg: 0.5, speed_rpm: 600 };
const omega = p.speed_rpm * 2 * Math.PI / 60;
function calculate(deg) {
  const t = deg * Math.PI / 180;
  const s = Math.sin(t), c = Math.cos(t);
  const d = Math.sqrt(p.rodLength_m * p.rodLength_m - p.crankRadius_m * p.crankRadius_m * s * s);
  const x = p.crankRadius_m * c + d;
  const dx = -p.crankRadius_m * s - (p.crankRadius_m * p.crankRadius_m * s * c) / d;
  const ddx = -p.crankRadius_m * c
    - (p.crankRadius_m * p.crankRadius_m * (c * c - s * s)) / d
    - (Math.pow(p.crankRadius_m, 4) * s * s * c * c) / Math.pow(d, 3);
  const velocity = omega * dx;
  const acceleration = omega * omega * ddx;
  const driveForce = p.sliderMass_kg * acceleration;
  const rodAxialForce = driveForce / (d / p.rodLength_m);
  const inputTorque = driveForce * dx;
  return {
    angle_deg: deg, time_s: deg / 360 * 60 / p.speed_rpm,
    displacement_mm: x * 1000, velocity_m_s: velocity,
    acceleration_m_s2: acceleration, drive_force_N: driveForce,
    inertia_force_N: -driveForce, rod_axial_force_N: rodAxialForce,
    input_torque_Nm: inputTorque
  };
}
function extrema(rows, key) {
  let min = rows[0], max = rows[0];
  for (const r of rows) { if (r[key] < min[key]) min = r; if (r[key] > max[key]) max = r; }
  return { min: min[key], minAt_deg: min.angle_deg, max: max[key], maxAt_deg: max.angle_deg, absMax: Math.max(Math.abs(min[key]), Math.abs(max[key])) };
}
const rows = [];
for (let deg = 0; deg <= 360; deg += 5) rows.push(calculate(deg));
const cols = Object.keys(rows[0]);
const csv = [cols.join(","), ...rows.map(r => cols.map(k => Number(r[k].toFixed(8))).join(","))].join("\n") + "\n";
fs.writeFileSync(path.join(out, "motion_results.csv"), csv, "utf8");
const fine = [];
for (let i = 0; i <= 3600; i++) fine.push(calculate(i / 10));
const stats = {
  model: p, omega_rad_s: omega, cycle_s: 60 / p.speed_rpm,
  stroke_mm: 2 * p.crankRadius_m * 1000,
  displacement: extrema(fine, "displacement_mm"),
  velocity: extrema(fine, "velocity_m_s"),
  acceleration: extrema(fine, "acceleration_m_s2"),
  drive_force: extrema(fine, "drive_force_N"),
  rod_axial_force: extrema(fine, "rod_axial_force_N"),
  input_torque: extrema(fine, "input_torque_Nm")
};
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(stats, null, 2) + "\n", "utf8");
function svgChart(filename, key, title, yLabel, unit, decimals) {
  const W = 960, H = 480, L = 92, R = 28, T = 50, B = 70;
  const pw = W - L - R, ph = H - T - B;
  const vals = rows.map(r => r[key]);
  let ymin = Math.min(...vals), ymax = Math.max(...vals);
  if (Math.abs(ymax - ymin) < 1e-12) { ymin -= 1; ymax += 1; }
  const pad = (ymax - ymin) * 0.12; ymin -= pad; ymax += pad;
  const x = a => L + a / 360 * pw;
  const y = v => T + (ymax - v) / (ymax - ymin) * ph;
  let marks = "";
  for (let i = 0; i <= 4; i++) {
    const v = ymin + (ymax - ymin) * i / 4, yy = y(v);
    marks += '<line x1="' + L + '" y1="' + yy + '" x2="' + (W-R) + '" y2="' + yy + '" stroke="#d7dee8" stroke-width="1"/>';
    marks += '<text x="' + (L-10) + '" y="' + (yy+5) + '" text-anchor="end" font-family="Arial" font-size="13" fill="#334155">' + v.toFixed(decimals) + '</text>';
  }
  for (let i = 0; i <= 6; i++) {
    const deg = i * 60, xx = x(deg);
    marks += '<line x1="' + xx + '" y1="' + T + '" x2="' + xx + '" y2="' + (H-B) + '" stroke="#e6ebf2" stroke-width="1"/>';
    marks += '<text x="' + xx + '" y="' + (H-B+24) + '" text-anchor="middle" font-family="Arial" font-size="13" fill="#334155">' + deg + '</text>';
  }
  const points = rows.map(r => x(r.angle_deg).toFixed(1) + ',' + y(r[key]).toFixed(1)).join(' ');
  const markup = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<title>' + title + ' vs crank angle</title><rect width="100%" height="100%" fill="#ffffff"/>' +
    '<text x="' + L + '" y="29" font-family="Arial" font-size="19" font-weight="700" fill="#172554">' + title + ' vs crank angle</text>' +
    marks + '<line x1="' + L + '" y1="' + (H-B) + '" x2="' + (W-R) + '" y2="' + (H-B) + '" stroke="#475569" stroke-width="1.5"/>' +
    '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H-B) + '" stroke="#475569" stroke-width="1.5"/>' +
    '<polyline points="' + points + '" fill="none" stroke="#1565c0" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<text x="' + (L+pw/2) + '" y="' + (H-14) + '" text-anchor="middle" font-family="Arial" font-size="14" fill="#334155">Crank angle (degrees)</text>' +
    '<text transform="translate(22 ' + (T+ph/2) + ') rotate(-90)" text-anchor="middle" font-family="Arial" font-size="14" fill="#334155">' + yLabel + ' (' + unit + ')</text></svg>';
  fs.writeFileSync(path.join(out, filename), markup, "utf8");
}
svgChart("position_graph.svg", "displacement_mm", "Slider displacement", "Displacement", "mm", 1);
svgChart("velocity_graph.svg", "velocity_m_s", "Slider velocity", "Velocity", "m/s", 2);
svgChart("acceleration_graph.svg", "acceleration_m_s2", "Slider acceleration", "Acceleration", "m/s²", 0);
svgChart("input_torque_graph.svg", "input_torque_Nm", "Crank input torque", "Torque", "N·m", 2);
const th = 45 * Math.PI / 180, scale = 1050, OX = 115, OY = 190;
const d = Math.sqrt(p.rodLength_m*p.rodLength_m - p.crankRadius_m*p.crankRadius_m*Math.sin(th)**2);
const sx = OX + (p.crankRadius_m*Math.cos(th)+d)*scale;
const cx = OX + p.crankRadius_m*Math.cos(th)*scale;
const cy = OY - p.crankRadius_m*Math.sin(th)*scale;
const svgModel = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 390" role="img"><title>Slider-crank mechanism at 45 degrees</title><desc>Crank radius 40 millimeters, connecting rod 160 millimeters, and slider on a horizontal guide.</desc>' +
'<rect width="880" height="390" rx="18" fill="#f8fafc"/><text x="38" y="43" font-family="Arial" font-size="22" font-weight="700" fill="#172554">Slider-crank kinematic model</text>' +
'<line x1="92" y1="' + OY + '" x2="765" y2="' + OY + '" stroke="#64748b" stroke-width="3"/><line x1="92" y1="' + (OY+14) + '" x2="765" y2="' + (OY+14) + '" stroke="#cbd5e1" stroke-width="2"/>' +
'<circle cx="' + OX + '" cy="' + OY + '" r="' + (p.crankRadius_m*scale) + '" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="7 6"/>' +
'<line x1="' + OX + '" y1="' + OY + '" x2="' + cx + '" y2="' + cy + '" stroke="#ea580c" stroke-width="10" stroke-linecap="round"/>' +
'<line x1="' + cx + '" y1="' + cy + '" x2="' + sx + '" y2="' + OY + '" stroke="#2563eb" stroke-width="10" stroke-linecap="round"/>' +
'<circle cx="' + OX + '" cy="' + OY + '" r="8" fill="#0f172a"/><circle cx="' + cx + '" cy="' + cy + '" r="8" fill="#ea580c"/>' +
'<rect x="' + (sx-34) + '" y="' + (OY-25) + '" width="68" height="50" rx="8" fill="#16a34a"/>' +
'<text x="' + (OX-10) + '" y="' + (OY+38) + '" font-family="Arial" font-size="15" fill="#334155">O</text>' +
'<text x="' + ((OX+cx)/2-4) + '" y="' + (OY-27) + '" font-family="Arial" font-size="15" fill="#9a3412">r = 40 mm</text>' +
'<text x="' + ((cx+sx)/2-48) + '" y="' + (OY-48) + '" font-family="Arial" font-size="15" fill="#1d4ed8">L = 160 mm</text>' +
'<text x="' + (sx-27) + '" y="' + (OY+6) + '" font-family="Arial" font-size="14" fill="#ffffff">slider</text>' +
'<text x="495" y="325" font-family="Arial" font-size="14" fill="#475569">Stroke = 80 mm • crank angle shown = 45° • line of stroke</text></svg>';
fs.writeFileSync(path.join(out, "slider_crank_model.svg"), svgModel, "utf8");
function n(v, d) { return Number(v).toFixed(d); }
const report = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Task 3 — Slider-Crank Motion Simulation</title>' +
'<style>body{font-family:Arial,sans-serif;max-width:1000px;margin:36px auto;padding:0 22px;color:#172033;line-height:1.55}h1,h2{color:#17365d}h1{margin-bottom:4px}.sub{color:#52647b;margin-top:0}.hero{width:100%;border-radius:12px;background:#f8fafc}table{border-collapse:collapse;width:100%;margin:14px 0 24px}th,td{border-bottom:1px solid #d9e1ec;padding:9px 12px;text-align:left}th{background:#eef3f9}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid img{width:100%;border:1px solid #d9e1ec;border-radius:8px}.note{background:#f3f6fa;padding:14px 18px;border-left:4px solid #2c64a0;border-radius:4px}.foot{font-size:13px;color:#52647b}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style><body>' +
'<h1>Task 3 — Slider-Crank Motion Simulation</h1><p class="sub">Kinematic and slider-inertia study • 40 mm crank • 160 mm connecting rod • 600 rpm</p>' +
'<img class="hero" src="slider_crank_model.svg" alt="Slider-crank mechanism geometry"/>' +
'<h2>Objective</h2><p>Model one complete crank revolution and report slider displacement, velocity, acceleration, connecting-rod axial force, and crank input torque. The crank rotates at constant speed and the slider reciprocates along a straight guide.</p>' +
'<h2>Model and assumptions</h2><p>Planar rigid-link slider-crank geometry is evaluated with the exact closed-form kinematic relation. Crank radius r = 0.040 m, connecting-rod length L = 0.160 m, slider mass m = 0.50 kg, and crank speed n = 600 rpm (ω = ' + n(omega,3) + ' rad/s). Positive displacement is from crank center toward the outer dead center. The connecting rod and crank are treated as massless; only the slider inertia is included. No external process load, friction, joint clearance, compliance, or flywheel inertia is modeled.</p>' +
'<h2>Peak motion and force results</h2><table><thead><tr><th>Output</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>' +
'<tr><td>Slider displacement</td><td>' + n(stats.displacement.min,2) + ' mm</td><td>' + n(stats.displacement.max,2) + ' mm</td></tr>' +
'<tr><td>Slider velocity</td><td>' + n(stats.velocity.min,3) + ' m/s</td><td>' + n(stats.velocity.max,3) + ' m/s</td></tr>' +
'<tr><td>Slider acceleration</td><td>' + n(stats.acceleration.min,2) + ' m/s²</td><td>' + n(stats.acceleration.max,2) + ' m/s²</td></tr>' +
'<tr><td>Drive force on slider (m·a)</td><td>' + n(stats.drive_force.min,2) + ' N</td><td>' + n(stats.drive_force.max,2) + ' N</td></tr>' +
'<tr><td>Rod axial force</td><td>' + n(stats.rod_axial_force.min,2) + ' N</td><td>' + n(stats.rod_axial_force.max,2) + ' N</td></tr>' +
'<tr><td>Input torque for slider inertia</td><td>' + n(stats.input_torque.min,3) + ' N·m</td><td>' + n(stats.input_torque.max,3) + ' N·m</td></tr></tbody></table>' +
'<h2>Motion plots</h2><div class="grid"><img src="position_graph.svg" alt="Slider displacement versus crank angle"><img src="velocity_graph.svg" alt="Slider velocity versus crank angle"><img src="acceleration_graph.svg" alt="Slider acceleration versus crank angle"><img src="input_torque_graph.svg" alt="Crank input torque versus crank angle"></div>' +
'<h2>Observations</h2><ul><li>The slider completes an 80 mm stroke every 0.100 s at the selected speed.</li><li>Velocity is zero at the dead centers and reaches its largest magnitude between them.</li><li>Acceleration and inertia force peak near the dead-center regions; the finite connecting-rod length makes the two half-strokes asymmetric in time.</li><li>Input torque changes sign over a cycle because the slider inertia alternately absorbs and returns energy. The ideal cycle-average torque is zero with no external load or losses.</li></ul>' +
'<div class="note"><strong>Interpretation:</strong> Results are from a transparent analytical kinematic/inertial model of a planar rigid-link mechanism. They are not claimed as output from CATIA DMU Kinematics or a multibody dynamics solver. Mass of the links, bearing friction, external load, and flexible-body effects require additional model data.</div>' +
'<h2>Files and reproduction</h2><p>Open <code>motion_simulation.html</code> for the animated mechanism and live readouts. <code>motion_results.csv</code> contains one sample every 5°; <code>slider_crank_sim.js</code> regenerates the table, plots, and this report with Node.js.</p><p class="foot">Task 3 submission • Slider-crank mechanism • SI calculations, displayed in mm where indicated</p></body></html>';
fs.writeFileSync(path.join(out, "report.html"), report, "utf8");
const readme = '# Task 3 — Slider-Crank Motion Simulation\n\nA single slider-crank mechanism is simulated through one crank revolution. This repository contains a browser animation, a short report, motion data, plots, and the source that regenerates the numeric results.\n\n![Slider-crank model](slider_crank_model.svg)\n\n## Open the submission\n\n- [Motion simulation and animation](motion_simulation.html)\n- [Short report](report.html)\n- [Motion results CSV](motion_results.csv)\n- [Complete submission package (ZIP)](task3_slider_crank_submission.zip)\n\n## Model\n\nCrank radius: 40 mm • Connecting rod: 160 mm • Slider mass: 0.50 kg • Constant crank speed: 600 rpm • Stroke: 80 mm.\n\nThe calculations use exact planar slider-crank kinematics and include slider inertia only. The report covers displacement, velocity, acceleration, drive force, connecting-rod axial force, and ideal crank input torque. Link masses, friction, joint clearance, flexibility, and external load are excluded.\n\nThe interactive simulation runs locally in a modern browser. GitHub displays the source for the HTML file; download it or clone the repository to run it. The results are analytical model output and are not represented as CATIA DMU Kinematics solver results.\n\n## Files\n\n- slider_crank_sim.js — Node.js generator for data, summary, report, and plots.\n- motion_results.csv — complete-cycle results at 5° increments.\n- summary.json — model inputs and extrema.\n- slider_crank_model.svg and *_graph.svg — overview and motion plots.\n- motion_simulation.html — animated linkage with adjustable angle/speed and live charts.\n- report.html — brief method, results, observations, and limitations.\n';
fs.writeFileSync(path.join(out, "README.md"), readme, "utf8");
console.log(JSON.stringify(stats, null, 2));
