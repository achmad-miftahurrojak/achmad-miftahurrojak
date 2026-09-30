const SVG_NS = "http://www.w3.org/2000/svg";
const COLOR_FALLBACKS = ["#38bdf8", "#2dd4bf", "#fbbf24", "#c084fc", "#fb7185", "#a3e635", "#818cf8", "#fb923c", "#67e8f9", "#f472b6"];
const radius = 78;
const circumference = 2 * Math.PI * radius;
const svg = document.querySelector("#donut");
const chartViewport = document.querySelector("#chart-viewport");
const segmentGroup = document.querySelector("#segments");
const legend = document.querySelector("#legend");
const centerLabel = document.querySelector("#center-label");
const centerValue = document.querySelector("#center-value");
const centerDetail = document.querySelector("#center-detail");
const updatedAt = document.querySelector("#updated-at");
let segments = [];
let activeName = null;
let progress = 0;
let startTime = null;
let frameId = null;
let isVisible = false;
const duration = 1050;

function clearHighlight() {
  activeName = null;
  segmentGroup.querySelectorAll(".donut-segment").forEach((node) => node.classList.remove("is-active"));
  legend.querySelectorAll(".legend-row").forEach((node) => node.classList.remove("is-active"));
  centerLabel.textContent = "ALL REPOSITORIES";
  centerValue.textContent = `${segments.length}`;
  centerDetail.textContent = segments.length === 1 ? "language" : "languages";
}

function highlight(segment) {
  activeName = segment.name;
  segmentGroup.querySelectorAll(".donut-segment").forEach((node) => node.classList.toggle("is-active", node.dataset.name === activeName));
  legend.querySelectorAll(".legend-row").forEach((node) => node.classList.toggle("is-active", node.dataset.name === activeName));
  centerLabel.textContent = segment.name;
  centerValue.textContent = `${segment.share.toFixed(1)}%`;
  centerDetail.textContent = "of detected code";
}

function draw(progressValue) {
  let passedShare = 0;
  segments.forEach((segment) => {
    const node = segment.node;
    const fullLength = circumference * segment.share / 100;
    const gap = Math.min(1.8, fullLength * 0.08);
    const animatedLength = Math.max(0, fullLength * progressValue - (progressValue >= 1 ? gap : 0));
    node.style.strokeDasharray = `${animatedLength} ${circumference}`;
    node.style.strokeDashoffset = `${-circumference * passedShare / 100}`;
    passedShare += segment.share;
  });
}

function animate(timestamp) {
  if (!isVisible) return;
  if (startTime === null) startTime = timestamp - progress * duration;
  progress = Math.min(1, (timestamp - startTime) / duration);
  draw(progress);
  if (progress < 1) frameId = requestAnimationFrame(animate);
  else { frameId = null; startTime = null; }
}

function enterViewport() {
  isVisible = true;
  chartViewport.classList.add("is-visible");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    progress = 1;
    draw(progress);
    return;
  }
  if (progress >= 1) progress = 0;
  if (frameId === null) frameId = requestAnimationFrame(animate);
}

function leaveViewport() {
  isVisible = false;
  chartViewport.classList.remove("is-visible");
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  startTime = null;
}

function addSegment(segment, index, totalShare) {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("class", "donut-segment");
  circle.setAttribute("cx", "120");
  circle.setAttribute("cy", "120");
  circle.setAttribute("r", String(radius));
  circle.setAttribute("pathLength", String(circumference));
  circle.setAttribute("tabindex", "0");
  circle.setAttribute("role", "button");
  circle.setAttribute("aria-label", `${segment.name}: ${segment.share.toFixed(1)} percent`);
  circle.style.stroke = segment.color || COLOR_FALLBACKS[index % COLOR_FALLBACKS.length];
  circle.dataset.name = segment.name;
  circle.addEventListener("pointerenter", () => highlight(segment));
  circle.addEventListener("pointerleave", () => { if (!legend.querySelector(":hover")) clearHighlight(); });
  circle.addEventListener("focus", () => highlight(segment));
  circle.addEventListener("blur", clearHighlight);
  segmentGroup.append(circle);
  segment.node = circle;

  const row = document.createElement("button");
  row.type = "button";
  row.className = "legend-row";
  row.dataset.name = segment.name;
  row.setAttribute("aria-label", `${segment.name}, ${segment.share.toFixed(1)} percent`);
  row.innerHTML = `<span class="legend-swatch" style="--color:${segment.color}" aria-hidden="true"></span><span class="legend-name"></span><span class="legend-percent">${segment.share.toFixed(1)}%</span><span class="legend-track" aria-hidden="true"><span class="legend-bar" style="--share:${(segment.share / totalShare * 100).toFixed(2)}%;--color:${segment.color}"></span></span>`;
  row.querySelector(".legend-name").textContent = segment.name;
  row.addEventListener("pointerenter", () => highlight(segment));
  row.addEventListener("pointerleave", clearHighlight);
  row.addEventListener("focus", () => highlight(segment));
  row.addEventListener("blur", clearHighlight);
  legend.append(row);
}

async function loadChart() {
  try {
    const response = await fetch("./languages.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Language data request failed: ${response.status}`);
    const data = await response.json();
    const totalShare = data.languages.reduce((sum, item) => sum + item.share, 0);
    segments = data.languages.map((item, index) => ({
      name: item.name,
      share: Number(item.share),
      color: item.color || COLOR_FALLBACKS[index % COLOR_FALLBACKS.length],
    }));
    legend.replaceChildren();
    segments.forEach((segment, index) => addSegment(segment, index, totalShare));
    updatedAt.textContent = data.updated_at ? `UPDATED ${new Date(data.updated_at).toLocaleDateString()}` : "GITHUB REPOSITORIES";
    clearHighlight();
    draw(0);
    if (!("IntersectionObserver" in window)) enterViewport();
    else new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting ? enterViewport() : leaveViewport()), { threshold: 0.35 }).observe(chartViewport);
  } catch (error) {
    legend.innerHTML = '<p class="empty-state">Language data is updating. Please check back shortly.</p>';
    centerLabel.textContent = "LANGUAGE DATA";
    centerValue.textContent = "—";
    centerDetail.textContent = "updating";
    console.error(error);
  }
}

loadChart();
