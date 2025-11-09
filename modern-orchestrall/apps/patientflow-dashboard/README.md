# PatientFlow Dashboard

A real-time dashboard for monitoring clinic operations, patient communications, and appointments. Built with Next.js and designed to work seamlessly with the Modern Orchestrall PatientFlow API.

## 🚀 Features

### Real-time Monitoring
- **Live Conversations**: Monitor WhatsApp, SMS, and email messages as they arrive
- **Active Call Sessions**: Track ongoing calls with duration and summaries
- **Appointment Management**: View and filter upcoming appointments
- **Key Metrics**: Real-time dashboard with messages, calls, and booking statistics

### User Experience
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Auto-refresh**: Data updates automatically every 10 seconds
- **Demo Mode**: One-click access without authentication setup
- **Modern UI**: Clean, intuitive interface built with Tailwind CSS

### Technical Features
- **TypeScript**: Full type safety and better development experience
- **API Integration**: Seamless backend communication with error handling
- **Authentication**: JWT and API key support
- **Performance Optimized**: Efficient data fetching and rendering

## 📸 Screenshots

*Dashboard Overview with key metrics*
![Dashboard](https://via.placeholder.com/800x400/1e40af/ffffff?text=PatientFlow+Dashboard)

*Live Conversations Feed*
![Conversations](https://via.placeholder.com/800x400/059669/ffffff?text=Live+Conversations)

*Appointment Management*
![Appointments](https://via.placeholder.com/800x400/7c3aed/ffffff?text=Appointment+Management)

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS, Lucide Icons
- **Charts**: Recharts for data visualization
- **API**: Axios for HTTP requests
- **Authentication**: JWT + API Key support
- **Development**: ESLint, Hot Module Replacement

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- Modern Orchestrall backend running
- PostgreSQL database with PatientFlow data

### Installation

1. **Clone and Install**:
```bash
cd apps/patientflow-dashboard
npm install
```

2. **Environment Setup**:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API configuration
```

3. **Start Development**:
```bash
npm run dev
```

4. **Access Dashboard**:
Open http://localhost:3001 in your browser

### One-Click Demo

The dashboard includes a demo mode for easy testing:

1. Visit the dashboard URL
2. Click "Enter Dashboard Demo"
3. Experience all features with simulated data

## 🔧 Configuration

### Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_DEMO_KEY=demo-key-for-development

# Authentication
NEXT_PUBLIC_DEMO_EMAIL=admin@example.com
NEXT_PUBLIC_DEMO_PASSWORD=password123

# Development Settings
NEXT_PUBLIC_NODE_ENV=development
NEXT_PUBLIC_REFRESH_INTERVAL=10000
```

## 📊 Features in Detail

### Dashboard Metrics
- Total Messages (WhatsApp, SMS, Email)
- Total Calls (inbound/outbound)
- Appointments (booked, confirmed, cancelled)
- Active Conversations (last 24 hours)
- Upcoming Appointments count

### Live Conversations
- Real-time message feed
- Channel indicators (WhatsApp, SMS, Email)
- Direction indicators (inbound/outbound)
- Patient information display
- Timestamp with relative time
- Auto-refresh every 10 seconds

### Appointment Management
- Upcoming appointments list
- Status filtering (Booked, Confirmed, Cancelled)
- Doctor and patient information
- Scheduled time and duration
- Pagination support
- One-click status updates

### Active Call Sessions
- Live call monitoring
- Call duration tracking
- Direction indicators
- Patient details
- Call summaries
- Transcript access (when available)

## 🏗️ Architecture

### Component Structure
```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with AuthProvider
│   └── page.tsx           # Main dashboard page
├── components/            # Reusable React components
│   ├── MetricsCard.tsx    # Metrics display cards
│   ├── AppointmentsList.tsx # Appointments management
│   ├── LiveConversations.tsx # Real-time messages
│   └── ActiveCalls.tsx    # Active call sessions
├── contexts/              # React Context providers
│   └── AuthContext.tsx    # Authentication state
└── lib/                   # Utility libraries
    └── api.ts             # API client and TypeScript types
```

### Data Flow
1. **Authentication**: AuthProvider manages user state
2. **API Client**: Centralized API communication with error handling
3. **Components**: Each component manages its own data fetching
4. **Auto-refresh**: useEffect hooks for periodic data updates
5. **Error Handling**: Graceful degradation and user feedback

## 🔌 API Integration

The dashboard integrates with these backend endpoints:

- `GET /patientflow/api/dashboard/overview` - Dashboard metrics
- `GET /patientflow/api/dashboard/appointments` - Appointments with filters
- `GET /patientflow/api/dashboard/calls/active` - Active call sessions
- `GET /patientflow/api/dashboard/activities` - Recent activities
- `GET /patientflow/api/dashboard/conversations/live` - Live conversations

### Authentication Methods

1. **Demo Mode**: API key authentication for development
2. **Production**: JWT token authentication with secure storage

## 🚀 Deployment

### Static Export (Vercel/Netlify)
```bash
npm run build
# Deploy the .next directory
```

### Docker Deployment
```bash
docker build -t patientflow-dashboard .
docker run -p 3001:3001 patientflow-dashboard
```

### Railway
```bash
railway up
```

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Code Quality
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Component-based architecture
- Comprehensive error handling

## 🔒 Security

- Environment variable protection
- CORS configuration
- Input validation
- Secure token storage
- API rate limiting support
- HTTPS enforcement in production

## 📈 Performance

- Automatic code splitting
- Image optimization
- Efficient data fetching
- Minimal bundle size
- Fast page loads
- Optimized re-renders

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is part of the Modern Orchestrall platform and follows the same licensing terms.

## 🆘 Support

For issues and questions:

1. Check the [deployment guide](../docs/patientflow/deployment.md)
2. Review browser console for errors
3. Verify backend API endpoints
4. Check environment configuration
5. Test with demo data first

## 🔄 Updates

The dashboard is actively maintained with regular updates:

- New features based on user feedback
- Performance optimizations
- Security enhancements
- Bug fixes and improvements
- API compatibility updates

---

Built with ❤️ for the Modern Orchestrall ecosystem