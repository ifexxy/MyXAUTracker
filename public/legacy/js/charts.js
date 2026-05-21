function buildHistory(basePrice, days, volatility = 18) {
  const points = [];
  let p = basePrice * (1 - 0.03 * Math.random());
  const n = days * 8;
  for (let i = 0; i < n; i++) {
    p += (Math.random() - 0.492) * volatility;
    p = Math.max(p, basePrice * 0.85);
    points.push(parseFloat(p.toFixed(2)));
  }
  points.push(basePrice);
  return points;
}

function buildLabels(days, count) {
  const labels = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() - (count - i) * (days * 86400000 / count));
    labels.push(days <= 1
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' }));
  }
  return labels;
}

function makeChart(canvasId, labels, data, color) {
  const ctx  = document.getElementById(canvasId).getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, color + '00');
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: color, borderWidth: 2, fill: true, backgroundColor: grad, pointRadius: 0, tension: 0.4 }] },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0e1622', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          titleColor: '#6e7f99', bodyColor: '#e8edf5',
          bodyFont: { family: 'Space Mono', size: 13 },
          callbacks: {
            title: () => 'XAU/USD',
            label: ctx => ' $' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })
          }
        }
      },
      scales: {
        x: { display: false },
        y: {
          display: true, position: 'right',
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: { color: '#3a4a60', font: { family: 'Space Mono', size: 10 }, callback: v => '$' + v.toLocaleString() }
        }
      }
    }
  });
}
