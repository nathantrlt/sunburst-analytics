# 📊 Sunburst Analytics

A complete analytics platform with Sunburst visualization for tracking and analyzing user journeys on websites.

## Features

- 🔐 **User Authentication** - Secure JWT-based authentication system
- 📈 **Real-time Tracking** - Track pageviews, user sessions, and journey paths
- 🎨 **Sunburst Visualization** - Interactive D3.js sunburst charts for journey analysis
- 📊 **Comprehensive Analytics** - Statistics on pageviews, users, and engagement
- 🔧 **Easy Integration** - Simple tracking snippet for any website
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎯 **SPA Support** - Compatible with Single Page Applications

## Tech Stack

**Backend:**
- Node.js
- Express.js
- MySQL
- JWT for authentication
- bcrypt for password hashing

**Frontend:**
- HTML5/CSS3
- Vanilla JavaScript
- D3.js for visualizations

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

### Step 1: Clone or Download

Navigate to the project directory:
```bash
cd "Projet sunburst"
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup MySQL Database

1. Create a new MySQL database:
```sql
CREATE DATABASE sunburst_analytics;
```

2. The application will automatically create the required tables on first run.

### Step 4: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and update the configuration:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=sunburst_analytics
JWT_SECRET=your_very_long_and_random_secret_key_here
NODE_ENV=development
```

**Important:** Change the `JWT_SECRET` to a long, random string in production!

### Step 5: Start the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Usage

### 1. Create an Account

1. Open your browser and go to `http://localhost:3000/index.html`
2. Click "Sign up" and create a new account
3. You'll be automatically logged in and redirected to the dashboard

### 2. Add a Website

1. In the dashboard, click "Add New Site"
2. Enter your website name and URL
3. Click "Create Site"
4. Copy the tracking snippet provided

### 3. Install Tracking Snippet

Add the tracking snippet to your website before the closing `</head>` tag:

```html
<script>
(function() {
  window.SUNBURST_API_KEY = 'your_api_key_here';
  window.SUNBURST_ENDPOINT = 'http://localhost:3000/api/track';

  var script = document.createElement('script');
  script.src = 'http://localhost:3000/tracker.js';
  script.async = true;
  document.head.appendChild(script);
})();
</script>
```

**Alternative:** Use Google Tag Manager to inject this snippet

### 4. View Analytics

1. Select your site from the sidebar
2. View statistics, user journeys, and page analytics
3. Use filters to analyze specific date ranges
4. Interact with the Sunburst visualization to explore user paths

## Project Structure

```
sunburst-analytics/
├── backend/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── middleware/
│   │   └── auth.js              # Authentication middleware
│   ├── models/
│   │   ├── user.js              # User model
│   │   ├── client.js            # Client/site model
│   │   └── pageview.js          # Pageview tracking model
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── clients.js           # Client management routes
│   │   ├── tracking.js          # Tracking endpoint
│   │   └── analytics.js         # Analytics data routes
│   └── server.js                # Main Express server
├── frontend/
│   ├── public/
│   │   ├── css/
│   │   │   └── styles.css       # Application styles
│   │   ├── js/
│   │   │   ├── auth.js          # Login/register logic
│   │   │   ├── dashboard.js     # Dashboard logic
│   │   │   └── sunburst.js      # D3.js visualization
│   │   ├── index.html           # Login/register page
│   │   └── dashboard.html       # Main dashboard
│   └── tracking-snippet/
│       └── tracker.js           # Client-side tracking script
├── package.json
├── .env.example
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Clients
- `GET /api/clients` - Get all user's sites
- `POST /api/clients` - Create new site
- `GET /api/clients/:id` - Get site details
- `DELETE /api/clients/:id` - Delete site

### Tracking
- `POST /api/track` - Track pageview
- `POST /api/track/time` - Update time spent

### Analytics
- `GET /api/analytics/stats/:clientId` - Get statistics
- `GET /api/analytics/sunburst/:clientId` - Get sunburst data
- `GET /api/analytics/page-positions/:clientId` - Get page analytics

## Database Schema

### users
- `id` - Primary key
- `email` - Unique email address
- `password` - Hashed password
- `name` - User's full name
- `created_at` - Timestamp

### clients
- `id` - Primary key
- `user_id` - Foreign key to users
- `site_name` - Website name
- `site_url` - Website URL
- `api_key` - Unique API key
- `created_at` - Timestamp

### pageviews
- `id` - Primary key
- `client_id` - Foreign key to clients
- `session_id` - Session identifier
- `user_identifier` - User identifier
- `page_url` - Page URL
- `page_title` - Page title
- `sequence_number` - Order in journey
- `time_spent` - Time on page (seconds)
- `device_type` - mobile/desktop/tablet
- `user_location` - User location
- `timestamp` - Timestamp
- `referrer` - Previous page

## Features in Detail

### Sunburst Visualization

The sunburst chart shows user journeys as hierarchical circles:
- **Center**: Starting point of journeys
- **Inner rings**: Early pages in journey
- **Outer rings**: Later pages in journey
- **Segment size**: Proportional to number of views
- **Colors**: Different branches for different paths

**Interactions:**
- Hover to see page details
- Click to zoom into a path
- Click center to reset zoom

### Tracking Features

The tracking snippet automatically captures:
- Page URL and title
- Session tracking
- User identification (anonymous)
- Device type detection
- Time spent on each page
- Navigation sequence
- Single Page Application (SPA) support

### Analytics Dashboard

**Statistics Cards:**
- Total pageviews
- Unique users
- Average pages per session
- Average time per page

**Filters:**
- Date range filtering
- Journey depth selection

**Page Analytics Table:**
- All tracked pages
- View counts
- Average position in journey
- Average time spent
- Sortable columns
- Pagination

## Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Protected API routes
- ✅ Input validation
- ✅ SQL injection prevention (prepared statements)
- ✅ CORS configuration
- ✅ Rate limiting on tracking endpoints
- ✅ Helmet.js security headers

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for auto-reloading on file changes.

### Testing the Tracker

Create a simple HTML file to test tracking:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <script>
    (function() {
      window.SUNBURST_API_KEY = 'your_api_key';
      window.SUNBURST_ENDPOINT = 'http://localhost:3000/api/track';

      var script = document.createElement('script');
      script.src = 'http://localhost:3000/tracker.js';
      script.async = true;
      document.head.appendChild(script);
    })();
    </script>
</head>
<body>
    <h1>Test Page</h1>
    <a href="page2.html">Go to Page 2</a>
</body>
</html>
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production` in `.env`
2. Use a strong, random `JWT_SECRET`
3. Configure MySQL for production
4. Update CORS settings in `server.js`
5. Use HTTPS for all connections
6. Update tracking snippet URLs to production domain

### Recommended

- Use a process manager like PM2
- Set up SSL/TLS certificates
- Configure a reverse proxy (nginx/Apache)
- Enable MySQL backups
- Set up monitoring and logging

## Troubleshooting

### Database Connection Failed

- Check MySQL is running
- Verify credentials in `.env`
- Ensure database exists
- Check MySQL user permissions

### Tracking Not Working

- Verify API key is correct
- Check browser console for errors
- Ensure CORS is properly configured
- Verify the tracking endpoint URL

### Login Issues

- Clear browser localStorage
- Check JWT_SECRET is set
- Verify database tables exist

## Contributing

This is a complete, production-ready analytics platform. Feel free to:
- Add new features
- Improve visualizations
- Enhance security
- Optimize performance

## License

ISC

## Support

For issues and questions, please check the code comments and this README.

---

Built with ❤️ using Node.js, Express, MySQL, and D3.js
