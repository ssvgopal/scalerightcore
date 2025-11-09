# 🔧 Kisaansay Technology Stack - Detailed Recommendations

## 📋 Executive Summary

This document provides detailed technology recommendations for building the scalable Kisaansay multi-FPC platform. It compares different architectural approaches, technology choices, and provides practical guidance for implementation decisions.

---

## 🏗️ Architecture Pattern Comparison

### **Option 1: Microservices Architecture (Recommended)**

**Description:** Independent services for each domain (FPC management, orders, logistics, marketing) communicating via APIs and message queues.

**Pros:**
- ✅ **Scalability:** Scale individual services independently
- ✅ **Team Independence:** Different teams can work on different services
- ✅ **Technology Flexibility:** Use best tools for each service
- ✅ **Fault Isolation:** Failure in one service doesn't bring down entire system
- ✅ **Easier Deployment:** Deploy services independently

**Cons:**
- ❌ **Complexity:** More moving parts to manage
- ❌ **Distributed Transactions:** Complex data consistency
- ❌ **Debugging:** Harder to trace issues across services
- ❌ **DevOps Overhead:** Requires robust CI/CD and monitoring

**Best For:**
- Large teams (10+ developers)
- Long-term scalability goals
- Complex business logic
- High transaction volumes (>10,000 orders/day)

**Cost:** Higher initial investment, lower long-term operational costs

---

### **Option 2: Modular Monolith**

**Description:** Single application with well-defined internal modules (FPC module, orders module, logistics module) but deployed as one unit.

**Pros:**
- ✅ **Simpler Development:** Easier to build and test
- ✅ **Easier Debugging:** Single codebase to debug
- ✅ **ACID Transactions:** Database transactions work natively
- ✅ **Lower DevOps Complexity:** Single deployment pipeline
- ✅ **Faster Initial Development:** Get to market quicker

**Cons:**
- ❌ **Scaling Limitations:** Must scale entire application
- ❌ **Deployment Risk:** Single deployment affects all features
- ❌ **Team Coupling:** Teams may step on each other's toes
- ❌ **Technology Lock-in:** Harder to change tech stack

**Best For:**
- Small to medium teams (2-10 developers)
- Shorter time-to-market requirements
- Moderate traffic (up to 5,000 orders/day)
- Budget constraints

**Cost:** Lower initial investment, potentially higher long-term costs

---

### **Option 3: Hybrid Architecture (Recommended for Kisaansay)**

**Description:** Start with modular monolith, extract critical services (logistics, payments) as microservices.

**Pros:**
- ✅ **Balanced Approach:** Get benefits of both patterns
- ✅ **Faster Initial Launch:** Start simple, scale later
- ✅ **Strategic Scaling:** Extract services as needed
- ✅ **Risk Mitigation:** Proven pattern for growing startups

**Cons:**
- ❌ **Refactoring Required:** Need to extract services later
- ❌ **Dual Complexity:** Manage both monolith and services

**Implementation Strategy:**
```
Phase 1 (Months 1-6): Modular Monolith
- FPC Management
- Product Catalog
- Orders
- Customer Management

Phase 2 (Months 7-9): Extract Critical Services
- Logistics Service (high complexity, external integrations)
- Payment Service (PCI compliance, security)
- Marketing Service (high traffic, can scale independently)

Phase 3 (Post-Launch): Extract as Needed
- Analytics Service (resource intensive)
- Search Service (Elasticsearch integration)
- Notification Service (high volume)
```

---

## 💻 Technology Stack Recommendations

### **Backend Framework**

#### **Option 1: Node.js + Fastify (Recommended)**

**Why Fastify:**
- 🚀 **Performance:** 30% faster than Express
- ✅ **Schema Validation:** Built-in JSON schema validation
- ✅ **Typescript Support:** Excellent TypeScript integration
- ✅ **Plugin System:** Modular architecture support
- ✅ **Modern:** Built for async/await patterns

**When to Use:**
- Team knows JavaScript/TypeScript
- Need high performance APIs
- Want modern, maintainable code

**Example Setup:**
```typescript
// src/app.ts
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';

const fastify = Fastify({
  logger: true,
  trustProxy: true
});

const prisma = new PrismaClient();

// Register plugins
await fastify.register(import('@fastify/cors'));
await fastify.register(import('@fastify/jwt'), {
  secret: process.env.JWT_SECRET
});
await fastify.register(import('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute'
});

// Register routes
await fastify.register(import('./routes/fpc'));
await fastify.register(import('./routes/products'));
await fastify.register(import('./routes/orders'));

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

// Start server
await fastify.listen({ port: 3000, host: '0.0.0.0' });
```

---

#### **Option 2: Node.js + NestJS**

**Why NestJS:**
- ✅ **Enterprise-grade:** Opinionated structure for large teams
- ✅ **Dependency Injection:** Clean, testable code
- ✅ **Microservices Support:** Built-in support for microservices
- ✅ **GraphQL:** Easy GraphQL integration

**When to Use:**
- Large team with Java/Spring background
- Complex business logic requiring DI
- GraphQL requirements

**Trade-offs:**
- 🐌 Slower than Fastify (15-20%)
- 📚 Steeper learning curve
- 💰 More boilerplate code

---

#### **Option 3: Python + FastAPI**

**Why FastAPI:**
- ✅ **Auto Documentation:** Swagger docs auto-generated
- ✅ **Type Safety:** Python type hints for validation
- ✅ **ML Integration:** Easy to integrate ML models
- ✅ **Async Support:** Built on Starlette for async

**When to Use:**
- Team knows Python
- Need ML/AI features (demand forecasting, recommendations)
- Want auto-generated API docs

**Trade-offs:**
- 🐌 Slower than Node.js (30-40%)
- 💰 Higher cloud costs (Python memory usage)

---

### **Database Strategy**

#### **Primary Database: PostgreSQL (Recommended)**

**Why PostgreSQL:**
- ✅ **ACID Compliance:** Strong consistency guarantees
- ✅ **JSON Support:** Store flexible JSON data alongside relational
- ✅ **Performance:** Excellent for complex queries
- ✅ **Extensions:** PostGIS for location data, full-text search
- ✅ **Open Source:** No licensing costs

**Schema Design Principles:**
```sql
-- Multi-tenant isolation
CREATE POLICY tenant_isolation ON fpcs
  USING (organization_id = current_setting('app.current_organization_id')::text);

-- Indexes for performance
CREATE INDEX idx_fpc_products_category ON fpc_products(category, status);
CREATE INDEX idx_orders_customer_date ON orders(customer_id, created_at DESC);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);

-- Partitioning for scale
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024_q1 PARTITION OF orders
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
```

---

#### **Secondary Database: MongoDB (Optional)**

**Use Cases:**
- Product catalog with varying attributes
- Customer activity logs
- Marketing campaign data

**When to Use:**
- Need flexible schema for products
- High write throughput for analytics events
- Document-oriented data

**Example:**
```javascript
// Product with flexible attributes
{
  _id: "prod_123",
  fpc_id: "fpc_456",
  name: "Organic Basmati Rice",
  category: "grains",
  base_attributes: {
    price: 250,
    unit: "kg",
    stock: 100
  },
  // Flexible attributes vary by category
  custom_attributes: {
    origin: "Dehradun",
    aging: "2 years",
    grain_length: "8.2mm",
    organic_certification: "India Organic",
    harvest_season: "Kharif 2023"
  }
}
```

---

#### **Cache Layer: Redis (Essential)**

**Use Cases:**
1. **Session Management:** Store user sessions
2. **Rate Limiting:** API rate limit counters
3. **Cart Data:** Shopping cart for guest users
4. **Product Cache:** Cache frequently accessed products
5. **Real-time Features:** Pub/sub for notifications

**Configuration:**
```javascript
// Redis caching strategy
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

// Cache-aside pattern
async function getProduct(productId) {
  // Check cache first
  const cached = await redisClient.get(`product:${productId}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const product = await prisma.fpcProduct.findUnique({
    where: { id: productId }
  });
  
  // Store in cache (TTL 1 hour)
  await redisClient.setEx(
    `product:${productId}`,
    3600,
    JSON.stringify(product)
  );
  
  return product;
}
```

---

### **Search Engine: Elasticsearch**

**Why Elasticsearch:**
- ✅ **Full-text Search:** Natural language product search
- ✅ **Faceted Search:** Filters (category, price range, location)
- ✅ **Autocomplete:** Search suggestions as user types
- ✅ **Analytics:** Aggregate queries for reporting

**Index Structure:**
```json
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": { "type": "keyword" },
          "autocomplete": { "type": "completion" }
        }
      },
      "category": { "type": "keyword" },
      "price": { "type": "float" },
      "fpc": {
        "properties": {
          "id": { "type": "keyword" },
          "name": { "type": "text" },
          "location": { "type": "geo_point" }
        }
      },
      "in_stock": { "type": "boolean" },
      "rating": { "type": "float" },
      "tags": { "type": "keyword" }
    }
  }
}
```

**Search Query Example:**
```javascript
const searchResults = await esClient.search({
  index: 'products',
  body: {
    query: {
      bool: {
        must: [
          { match: { name: 'organic rice' } }
        ],
        filter: [
          { term: { category: 'grains' } },
          { range: { price: { gte: 100, lte: 500 } } },
          { term: { in_stock: true } }
        ]
      }
    },
    aggs: {
      categories: { terms: { field: 'category' } },
      price_ranges: {
        range: {
          field: 'price',
          ranges: [
            { to: 100 },
            { from: 100, to: 300 },
            { from: 300, to: 500 },
            { from: 500 }
          ]
        }
      }
    },
    sort: [
      { _score: 'desc' },
      { rating: 'desc' }
    ],
    from: 0,
    size: 20
  }
});
```

---

### **Message Queue: RabbitMQ vs Kafka**

#### **RabbitMQ (Recommended for Start)**

**Use Cases:**
- Order confirmation emails
- SMS notifications
- Webhook deliveries
- Image processing queues

**Pros:**
- ✅ Easier to set up
- ✅ Lower resource requirements
- ✅ Good for <10,000 messages/sec
- ✅ Message acknowledgment built-in

**Example:**
```javascript
// Producer (Order Service)
await channel.sendToQueue('order.created', Buffer.from(JSON.stringify({
  orderId: 'ord_123',
  customerId: 'cust_456',
  totalAmount: 1500,
  items: [...]
})));

// Consumer (Email Service)
channel.consume('order.created', async (msg) => {
  const order = JSON.parse(msg.content.toString());
  
  await sendOrderConfirmationEmail(order);
  
  channel.ack(msg);
});
```

---

#### **Apache Kafka (For Scale)**

**Use Cases:**
- High-volume event streaming (>100,000 events/sec)
- Real-time analytics
- Event sourcing
- Multi-consumer scenarios

**When to Switch:**
- Order volume > 50,000/day
- Need event replay capability
- Real-time dashboards
- Complex event processing

**Trade-offs:**
- 💰 Higher infrastructure costs
- 📚 Steeper learning curve
- 🛠️ More complex operations

---

### **Frontend Technology**

#### **Customer Portal: Next.js 14+ (Recommended)**

**Why Next.js:**
- ✅ **SEO:** Server-side rendering for organic traffic
- ✅ **Performance:** Static generation for product pages
- ✅ **Image Optimization:** Automatic image optimization
- ✅ **API Routes:** Backend APIs in same project
- ✅ **TypeScript:** Type-safe React development

**Project Structure:**
```
customer-portal/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx              # Homepage
│   │   ├── about/page.tsx        # About us
│   │   └── blog/[slug]/page.tsx  # Blog posts (SSG)
│   ├── (shop)/
│   │   ├── products/page.tsx     # Product listing (SSR)
│   │   ├── products/[id]/page.tsx # Product detail (SSR)
│   │   ├── cart/page.tsx         # Shopping cart (CSR)
│   │   └── checkout/page.tsx     # Checkout (CSR)
│   ├── (account)/
│   │   ├── dashboard/page.tsx    # Customer dashboard
│   │   ├── orders/page.tsx       # Order history
│   │   └── profile/page.tsx      # Profile settings
│   └── api/
│       ├── products/route.ts     # Product API
│       └── orders/route.ts       # Order API
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── ProductCard.tsx
│   ├── CartSummary.tsx
│   └── OrderTracker.tsx
├── lib/
│   ├── prisma.ts                 # Database client
│   ├── redis.ts                  # Cache client
│   └── auth.ts                   # Authentication
└── public/
    ├── images/
    └── fonts/
```

**Performance Optimizations:**
```typescript
// Product listing with ISR (Incremental Static Regeneration)
export const revalidate = 3600; // Revalidate every hour

export default async function ProductsPage() {
  const products = await getProducts();
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// Product detail with dynamic OG images
export async function generateMetadata({ params }) {
  const product = await getProduct(params.id);
  
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      images: [product.image],
    },
  };
}
```

---

#### **FPC Admin Dashboard: React + Vite**

**Why Separate App:**
- Different authentication flow
- Different deployment cadence
- Admin-specific UI patterns
- Reduce customer portal bundle size

**Tech Stack:**
- React 18
- Vite (fast build tool)
- TanStack Query (data fetching)
- Zustand (state management)
- shadcn/ui (component library)
- Recharts (analytics charts)

---

#### **Mobile Apps: React Native (Recommended)**

**Why React Native:**
- ✅ **Code Sharing:** Share 80-90% code between iOS/Android
- ✅ **Developer Productivity:** Same team as web
- ✅ **Performance:** Near-native performance
- ✅ **Community:** Large ecosystem of libraries

**Alternative: Flutter**
- ✅ Better performance
- ✅ Beautiful UI out of the box
- ❌ Separate team/skillset required
- ❌ Smaller ecosystem

**Decision:**
- **React Native** if web team builds mobile
- **Flutter** if hiring dedicated mobile team

---

### **DevOps & Infrastructure**

#### **Container Orchestration**

**Kubernetes (Recommended for Production)**

**Pros:**
- ✅ Industry standard
- ✅ Auto-scaling
- ✅ Self-healing
- ✅ Zero-downtime deployments
- ✅ Multi-cloud portability

**Kubernetes Manifest Example:**
```yaml
# Deployment for Order Service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: kisaansay
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
      - name: order-service
        image: kisaansay/order-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: kisaansay
spec:
  selector:
    app: order-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: kisaansay
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

#### **CI/CD Pipeline**

**GitHub Actions (Recommended)**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linter
        run: npm run lint
      
      - name: Type check
        run: npm run typecheck

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t kisaansay/order-service:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push kisaansay/order-service:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/order-service \
            order-service=kisaansay/order-service:${{ github.sha }} \
            -n kisaansay
          
          kubectl rollout status deployment/order-service -n kisaansay
```

---

#### **Monitoring & Observability**

**Recommended Stack:**

1. **Prometheus** - Metrics collection
2. **Grafana** - Dashboards and visualization
3. **Loki** - Log aggregation
4. **Jaeger** - Distributed tracing
5. **Sentry** - Error tracking

**Metrics to Track:**
```javascript
// Custom metrics with Prometheus
import { register, Counter, Histogram } from 'prom-client';

// Order metrics
const orderCounter = new Counter({
  name: 'kisaansay_orders_total',
  help: 'Total orders created',
  labelNames: ['fpc_id', 'status']
});

const orderValue = new Histogram({
  name: 'kisaansay_order_value',
  help: 'Order value distribution',
  buckets: [100, 500, 1000, 2000, 5000, 10000]
});

// API latency
const httpDuration = new Histogram({
  name: 'kisaansay_http_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status']
});

// Usage
app.post('/orders', async (req, res) => {
  const end = httpDuration.startTimer();
  
  try {
    const order = await createOrder(req.body);
    
    orderCounter.inc({ fpc_id: order.fpcId, status: 'created' });
    orderValue.observe(order.totalAmount);
    
    res.json(order);
    end({ method: 'POST', route: '/orders', status: 200 });
  } catch (error) {
    end({ method: 'POST', route: '/orders', status: 500 });
    throw error;
  }
});
```

---

## 🔐 Security Best Practices

### **Authentication Flow**

```typescript
// JWT-based authentication with refresh tokens

interface TokenPayload {
  userId: string;
  organizationId: string;
  role: string;
  type: 'access' | 'refresh';
}

// Access token (short-lived: 15 minutes)
function generateAccessToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      type: 'access'
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
}

// Refresh token (long-lived: 7 days)
function generateRefreshToken(user: User): string {
  const token = jwt.sign(
    {
      userId: user.id,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  
  // Store refresh token in database for revocation
  await prisma.refreshToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  
  return token;
}

// Refresh endpoint
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  // Verify token
  const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
  
  // Check if token is in database (not revoked)
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true }
  });
  
  if (!storedToken || storedToken.revoked) {
    throw new Error('Invalid refresh token');
  }
  
  // Generate new access token
  const accessToken = generateAccessToken(storedToken.user);
  
  res.json({ accessToken });
});
```

---

### **Input Validation with Zod**

```typescript
import { z } from 'zod';

// Product creation schema
const createProductSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  category: z.enum(['grains', 'pulses', 'vegetables', 'fruits', 'dairy', 'spices']),
  basePrice: z.number().positive().max(100000),
  sellingPrice: z.number().positive().max(100000),
  unit: z.enum(['kg', 'gram', 'liter', 'piece']),
  packagingSize: z.number().positive(),
  images: z.array(z.string().url()).min(1).max(10),
  certifications: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional()
});

// Validation middleware
app.post('/products', async (req, res) => {
  try {
    // Validate input
    const data = createProductSchema.parse(req.body);
    
    // Business logic
    const product = await createProduct(data);
    
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    } else {
      throw error;
    }
  }
});
```

---

### **Rate Limiting**

```typescript
import rateLimit from '@fastify/rate-limit';

// Global rate limit
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  redis: redisClient
});

// Per-route rate limiting
fastify.post('/orders', {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute'
    }
  }
}, async (req, res) => {
  // Create order
});

// Per-user rate limiting
fastify.register(rateLimit, {
  max: 1000,
  timeWindow: '1 hour',
  keyGenerator: (req) => req.user.id, // Different limit per user
  redis: redisClient
});
```

---

## 📱 Mobile App Architecture

### **React Native Project Structure**

```
kisaansay-mobile/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── ProductListScreen.tsx
│   │   ├── ProductDetailScreen.tsx
│   │   ├── CartScreen.tsx
│   │   ├── CheckoutScreen.tsx
│   │   └── OrderHistoryScreen.tsx
│   ├── components/
│   │   ├── ProductCard.tsx
│   │   ├── AddToCartButton.tsx
│   │   ├── OrderTracker.tsx
│   │   └── SearchBar.tsx
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   └── TabNavigator.tsx
│   ├── services/
│   │   ├── api.ts              # API client
│   │   ├── auth.ts             # Authentication
│   │   └── storage.ts          # AsyncStorage wrapper
│   ├── hooks/
│   │   ├── useProducts.ts
│   │   ├── useCart.ts
│   │   └── useOrders.ts
│   ├── store/
│   │   ├── authStore.ts        # Zustand store
│   │   ├── cartStore.ts
│   │   └── settingsStore.ts
│   └── utils/
│       ├── formatting.ts
│       └── validation.ts
├── ios/                        # iOS native code
├── android/                    # Android native code
└── package.json
```

### **Offline Support**

```typescript
// Offline cart with sync
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class OfflineCartManager {
  private cartKey = '@cart';
  
  async addToCart(product: Product, quantity: number) {
    // Add to local cart immediately
    const cart = await this.getLocalCart();
    cart.items.push({ product, quantity });
    await AsyncStorage.setItem(this.cartKey, JSON.stringify(cart));
    
    // Sync to server if online
    const { isConnected } = await NetInfo.fetch();
    if (isConnected) {
      await this.syncCart(cart);
    }
  }
  
  async syncCart(cart: Cart) {
    try {
      await api.post('/cart/sync', cart);
      // Mark as synced
      cart.synced = true;
      await AsyncStorage.setItem(this.cartKey, JSON.stringify(cart));
    } catch (error) {
      console.error('Cart sync failed:', error);
      // Will retry on next app open
    }
  }
  
  async getLocalCart(): Promise<Cart> {
    const data = await AsyncStorage.getItem(this.cartKey);
    return data ? JSON.parse(data) : { items: [], synced: false };
  }
}
```

---

## 🎨 UI/UX Recommendations

### **Design System**

**Component Library:** shadcn/ui (Radix UI + Tailwind CSS)

**Why shadcn/ui:**
- ✅ **Copy-paste components:** Full control over code
- ✅ **Accessible:** Built on Radix UI primitives
- ✅ **Customizable:** Tailwind CSS for styling
- ✅ **Modern:** Latest React patterns

**Color Palette:**
```css
:root {
  /* Primary (Agricultural Green) */
  --primary-50: #f0fdf4;
  --primary-500: #22c55e;
  --primary-900: #14532d;
  
  /* Secondary (Earth Brown) */
  --secondary-50: #fefce8;
  --secondary-500: #eab308;
  --secondary-900: #713f12;
  
  /* Accent (Organic Orange) */
  --accent-500: #f97316;
  
  /* Neutrals */
  --gray-50: #f9fafb;
  --gray-900: #111827;
}
```

**Typography:**
- **Headings:** Inter (clean, modern)
- **Body:** System font stack (performance)
- **Monospace:** JetBrains Mono (code, SKUs)

---

## 🧪 Testing Strategy

### **Testing Pyramid**

```
              /\
             /E2E\        (10%) - Critical user flows
            /------\
           /  Int   \     (30%) - API integration tests
          /----------\
         /   Unit     \   (60%) - Business logic tests
        /--------------\
```

### **Unit Tests (Jest + Testing Library)**

```typescript
// services/order.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createOrder } from './order';

describe('Order Service', () => {
  beforeEach(() => {
    // Reset database
  });
  
  it('should create order with valid data', async () => {
    const orderData = {
      customerId: 'cust_123',
      items: [
        { productId: 'prod_456', quantity: 2 }
      ],
      shippingAddress: { /* ... */ }
    };
    
    const order = await createOrder(orderData);
    
    expect(order.id).toBeDefined();
    expect(order.status).toBe('pending');
    expect(order.totalAmount).toBeGreaterThan(0);
  });
  
  it('should fail with invalid product', async () => {
    const orderData = {
      customerId: 'cust_123',
      items: [
        { productId: 'invalid', quantity: 2 }
      ]
    };
    
    await expect(createOrder(orderData)).rejects.toThrow('Product not found');
  });
});
```

### **Integration Tests (Supertest)**

```typescript
// routes/products.test.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import { build } from './app';
import { createTestUser } from './test-utils';

describe('Products API', () => {
  let app;
  let token;
  
  beforeAll(async () => {
    app = await build();
    const user = await createTestUser();
    token = generateToken(user);
  });
  
  it('GET /products should return products', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/products',
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('products');
    expect(response.json().products).toBeInstanceOf(Array);
  });
  
  it('POST /products should create product', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/products',
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Organic Basmati Rice',
        category: 'grains',
        basePrice: 250,
        sellingPrice: 250
      }
    });
    
    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('id');
  });
});
```

### **E2E Tests (Playwright)**

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should complete order', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password123');
    await page.click('[type=submit]');
    
    // Add to cart
    await page.goto('/products/organic-rice');
    await page.click('[data-testid=add-to-cart]');
    await expect(page.locator('[data-testid=cart-count]')).toHaveText('1');
    
    // Checkout
    await page.goto('/checkout');
    await page.fill('[name=address]', '123 Main St');
    await page.fill('[name=city]', 'Mumbai');
    await page.fill('[name=pincode]', '400001');
    
    // Payment
    await page.click('[data-testid=place-order]');
    
    // Verify order confirmation
    await expect(page.locator('h1')).toContainText('Order Confirmed');
    await expect(page.locator('[data-testid=order-number]')).toBeVisible();
  });
});
```

---

## 📈 Performance Optimization

### **Database Query Optimization**

```typescript
// ❌ Bad: N+1 query problem
async function getOrdersWithProducts() {
  const orders = await prisma.order.findMany();
  
  for (const order of orders) {
    order.items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      include: { product: true }
    });
  }
  
  return orders;
}

// ✅ Good: Single query with includes
async function getOrdersWithProducts() {
  return await prisma.order.findMany({
    include: {
      items: {
        include: {
          product: true
        }
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });
}

// ✅ Better: Pagination + field selection
async function getOrdersWithProducts(page: number, limit: number = 20) {
  return await prisma.order.findMany({
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      customer: {
        select: {
          firstName: true,
          lastName: true
        }
      },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              name: true,
              image: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}
```

### **Caching Strategies**

```typescript
// 1. Cache-Aside Pattern
async function getProduct(id: string) {
  const cacheKey = `product:${id}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Fetch from DB
  const product = await prisma.fpcProduct.findUnique({ where: { id } });
  
  // Store in cache
  await redis.setex(cacheKey, 3600, JSON.stringify(product));
  
  return product;
}

// 2. Write-Through Pattern
async function updateProduct(id: string, data: Partial<Product>) {
  // Update database
  const product = await prisma.fpcProduct.update({
    where: { id },
    data
  });
  
  // Update cache
  await redis.setex(`product:${id}`, 3600, JSON.stringify(product));
  
  // Invalidate related caches
  await redis.del(`products:category:${product.category}`);
  await redis.del(`products:fpc:${product.fpcId}`);
  
  return product;
}

// 3. Cache Warming
async function warmCache() {
  // Pre-load popular products on server start
  const popularProducts = await prisma.fpcProduct.findMany({
    where: { featured: true },
    take: 100
  });
  
  const pipeline = redis.pipeline();
  for (const product of popularProducts) {
    pipeline.setex(
      `product:${product.id}`,
      3600,
      JSON.stringify(product)
    );
  }
  await pipeline.exec();
}
```

---

## 🎯 Conclusion

This technology stack provides Kisaansay with:

✅ **Scalability:** Handle growth from 1,000 to 1,000,000+ users
✅ **Performance:** Sub-200ms API responses, <2s page loads
✅ **Developer Productivity:** Modern tools, fast iteration
✅ **Cost Efficiency:** Open-source stack, optimized infrastructure
✅ **Maintainability:** Clean architecture, comprehensive testing

**Recommended Starting Stack:**
- **Backend:** Node.js + Fastify + Prisma + PostgreSQL
- **Frontend:** Next.js 14 (customer), React + Vite (admin)
- **Mobile:** React Native
- **Infrastructure:** Kubernetes on AWS/GCP
- **Cache:** Redis
- **Search:** Elasticsearch
- **Queue:** RabbitMQ (start), Kafka (scale)
- **Monitoring:** Prometheus + Grafana + Loki + Sentry

**Evolution Path:**
1. **Months 1-3:** Modular monolith
2. **Months 4-6:** Extract logistics + payment services
3. **Months 7-9:** Extract marketing + analytics services
4. **Post-launch:** Extract as needed based on scale

This approach balances **time-to-market** with **long-term scalability**.
