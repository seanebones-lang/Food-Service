import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const orderCreationTime = new Trend('order_creation_duration');
const menuLoadTime = new Trend('menu_load_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '3m', target: 200 },  // Stay at spike
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'http_req_failed': ['rate<0.05'],    // Less than 5% of requests should fail
    'errors': ['rate<0.05'],             // Less than 5% error rate
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Test data
const menuItemIds = [];

export function setup() {
  // Fetch menu items to get valid IDs
  const res = http.get(`${BASE_URL}/api/menu`);

  if (res.status === 200) {
    const data = JSON.parse(res.body);
    if (data.data && Array.isArray(data.data)) {
      return { menuItems: data.data.map(item => item.id) };
    }
  }

  return { menuItems: [] };
}

export default function (data) {
  // Test 1: Load menu items (most common operation)
  {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/menu`);

    const success = check(res, {
      'menu load status is 200': (r) => r.status === 200,
      'menu load has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && Array.isArray(body.data);
        } catch {
          return false;
        }
      },
    });

    menuLoadTime.add(Date.now() - start);
    errorRate.add(!success);
  }

  sleep(1);

  // Test 2: Create order (critical business operation)
  if (data.menuItems && data.menuItems.length > 0) {
    const randomMenuItem = data.menuItems[Math.floor(Math.random() * data.menuItems.length)];

    const orderPayload = JSON.stringify({
      orderItems: [
        {
          menuItemId: randomMenuItem,
          quantity: Math.floor(Math.random() * 3) + 1,
          notes: 'Load test order'
        }
      ],
      customerName: `LoadTest-${__VU}-${__ITER}`,
      channel: 'ONLINE',
      syncToSquare: false // Don't sync during load test
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/orders`, orderPayload, params);

    const success = check(res, {
      'order creation status is 201': (r) => r.status === 201,
      'order has ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data && body.data.id;
        } catch {
          return false;
        }
      },
    });

    orderCreationTime.add(Date.now() - start);
    errorRate.add(!success);
  }

  sleep(2);

  // Test 3: Health check (monitoring)
  {
    const res = http.get(`${BASE_URL}/health`);

    check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check is OK': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'OK';
        } catch {
          return false;
        }
      },
    });
  }

  sleep(1);

  // Test 4: Get orders (staff operation)
  {
    const res = http.get(`${BASE_URL}/api/orders?limit=10`);

    check(res, {
      'get orders status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-report.html': htmlReport(data),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n' + indent + '=============== Load Test Summary ===============\n\n';

  // HTTP metrics
  if (data.metrics.http_reqs) {
    summary += indent + `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  }

  if (data.metrics.http_req_duration) {
    summary += indent + `Request Duration:\n`;
    summary += indent + `  avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += indent + `  min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms\n`;
    summary += indent + `  p(95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += indent + `  p(99): ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
    summary += indent + `  max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
  }

  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    summary += indent + `\nFailed Requests: ${failRate}%\n`;
  }

  // Custom metrics
  if (data.metrics.menu_load_duration) {
    summary += indent + `\nMenu Load Duration (avg): ${data.metrics.menu_load_duration.values.avg.toFixed(2)}ms\n`;
  }

  if (data.metrics.order_creation_duration) {
    summary += indent + `Order Creation Duration (avg): ${data.metrics.order_creation_duration.values.avg.toFixed(2)}ms\n`;
  }

  summary += indent + '\n===============================================\n';

  return summary;
}

function htmlReport(data) {
  const metrics = data.metrics;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Load Test Report</title>
  <style>
    body {font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5;}
    .container {background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);}
    h1 {color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;}
    h2 {color: #555; margin-top: 30px;}
    .metric {background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; border-radius: 4px;}
    .metric-name {font-weight: bold; color: #333; margin-bottom: 5px;}
    .metric-value {color: #666; font-size: 18px;}
    .pass {color: #4CAF50;}
    .fail {color: #f44336;}
  </style>
</head>
<body>
  <div class="container">
    <h1>Restaurant POS Load Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>

    <h2>Test Summary</h2>
    <div class="metric">
      <div class="metric-name">Total HTTP Requests</div>
      <div class="metric-value">${metrics.http_reqs?.values.count || 0}</div>
    </div>

    <div class="metric">
      <div class="metric-name">Average Response Time</div>
      <div class="metric-value">${metrics.http_req_duration?.values.avg?.toFixed(2) || 0}ms</div>
    </div>

    <div class="metric">
      <div class="metric-name">95th Percentile Response Time</div>
      <div class="metric-value">${metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0}ms</div>
    </div>

    <div class="metric">
      <div class="metric-name">Failed Requests</div>
      <div class="metric-value ${(metrics.http_req_failed?.values.rate || 0) < 0.05 ? 'pass' : 'fail'}">
        ${((metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2)}%
      </div>
    </div>

    <h2>Business Metrics</h2>
    <div class="metric">
      <div class="metric-name">Menu Load Time (avg)</div>
      <div class="metric-value">${metrics.menu_load_duration?.values.avg?.toFixed(2) || 0}ms</div>
    </div>

    <div class="metric">
      <div class="metric-name">Order Creation Time (avg)</div>
      <div class="metric-value">${metrics.order_creation_duration?.values.avg?.toFixed(2) || 0}ms</div>
    </div>

    <h2>Virtual Users</h2>
    <div class="metric">
      <div class="metric-name">Peak Virtual Users</div>
      <div class="metric-value">${metrics.vus_max?.values.max || 0}</div>
    </div>
  </div>
</body>
</html>
  `;
}
