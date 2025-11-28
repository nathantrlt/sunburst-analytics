/**
 * Sunburst Analytics Tracking Snippet
 *
 * This script tracks user pageviews and sends data to the analytics backend.
 * Compatible with traditional websites and Single Page Applications (SPAs).
 *
 * Usage:
 * <script>
 *   (function() {
 *     var API_KEY = 'your_api_key_here';
 *     var API_ENDPOINT = 'http://localhost:3000/api/track';
 *     // Paste the content of tracker.js here
 *   })();
 * </script>
 */

(function() {
  'use strict';

  // Configuration - These should be set by the user
  var API_KEY = window.SUNBURST_API_KEY || 'YOUR_API_KEY';
  var API_ENDPOINT = window.SUNBURST_ENDPOINT || 'http://localhost:3000/api/track';

  // Get the actual page URL (handles GTM iframe)
  function getActualUrl() {
    try {
      // Try to get parent URL (for GTM iframe)
      return (window.top && window.top.location && window.top.location.href) || window.location.href;
    } catch (e) {
      // Fallback if cross-origin
      return window.location.href;
    }
  }

  // Get the actual page title (handles GTM iframe)
  function getActualTitle() {
    try {
      // Try to get parent title (for GTM iframe)
      return (window.top && window.top.document && window.top.document.title) || document.title;
    } catch (e) {
      // Fallback if cross-origin
      return document.title;
    }
  }

  // Get the actual referrer (handles GTM iframe)
  function getActualReferrer() {
    try {
      // Try to get parent referrer (for GTM iframe)
      return (window.top && window.top.document && window.top.document.referrer) || document.referrer;
    } catch (e) {
      // Fallback if cross-origin
      return document.referrer;
    }
  }

  // Session and state management
  var sessionId = getOrCreateSessionId();
  var sequenceNumber = getSequenceNumber();
  var currentPageUrl = getActualUrl();
  var pageStartTime = Date.now();
  var lastUrl = currentPageUrl;
  var heartbeatInterval = null;
  var retryQueue = [];
  var maxRetries = 3;
  var sessionReferrer = getOrCreateSessionReferrer();

  /**
   * Generate or retrieve session ID from sessionStorage
   */
  function getOrCreateSessionId() {
    var stored = sessionStorage.getItem('sunburst_session_id');
    if (stored) {
      return stored;
    }
    var newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('sunburst_session_id', newId);
    return newId;
  }

  /**
   * Get or create session referrer (the external referrer for the first page of the session)
   * This ensures all pages in a session have the same traffic source
   */
  function getOrCreateSessionReferrer() {
    var stored = sessionStorage.getItem('sunburst_session_referrer');
    if (stored !== null) {
      // Return stored value (can be empty string for direct traffic)
      return stored;
    }
    // First page of session - capture the actual external referrer
    var actualReferrer = getActualReferrer() || '';
    sessionStorage.setItem('sunburst_session_referrer', actualReferrer);
    return actualReferrer;
  }

  /**
   * Get or initialize sequence number from sessionStorage
   */
  function getSequenceNumber() {
    var stored = sessionStorage.getItem('sunburst_sequence_number');
    if (stored) {
      return parseInt(stored, 10);
    }
    return 0;
  }

  /**
   * Save sequence number to sessionStorage
   */
  function saveSequenceNumber(num) {
    sessionStorage.setItem('sunburst_sequence_number', num.toString());
  }

  /**
   * Get or create user identifier (persistent across sessions)
   */
  function getUserIdentifier() {
    var stored = localStorage.getItem('sunburst_user_id');
    if (stored) {
      return stored;
    }
    var newId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sunburst_user_id', newId);
    return newId;
  }

  /**
   * Detect device type
   */
  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  /**
   * Get user location (country/city from browser if available)
   */
  function getUserLocation() {
    // This is a simplified version. In production, you might use IP geolocation on the server
    var lang = navigator.language || navigator.userLanguage;
    return lang || 'unknown';
  }

  /**
   * Send tracking data to backend
   */
  function sendTrackingData(data, isRetry) {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
      console.warn('Sunburst Analytics: API key not configured');
      return;
    }

    var payload = {
      sessionId: sessionId,
      userIdentifier: getUserIdentifier(),
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle,
      sequenceNumber: data.sequenceNumber,
      timeSpent: data.timeSpent || 0,
      deviceType: getDeviceType(),
      userLocation: getUserLocation(),
      referrer: data.referrer || getActualReferrer() || null,
      apiKey: API_KEY
    };

    // Use sendBeacon if available (more reliable on page unload)
    if (navigator.sendBeacon && data.timeSpent > 0) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(API_ENDPOINT, blob);
      return;
    }

    // Otherwise use fetch with retry logic
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload),
      keepalive: true
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Tracking request failed: ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      // Success
    })
    .catch(function(error) {
      console.error('Sunburst Analytics tracking error:', error);

      // Retry logic
      if (!isRetry && data.retryCount < maxRetries) {
        data.retryCount = (data.retryCount || 0) + 1;
        retryQueue.push(data);
        setTimeout(function() {
          var retryData = retryQueue.shift();
          if (retryData) {
            sendTrackingData(retryData, true);
          }
        }, 2000 * data.retryCount);
      }
    });
  }

  /**
   * Update time spent on current page
   */
  function updateTimeSpent() {
    var timeSpent = Math.floor((Date.now() - pageStartTime) / 1000);

    if (timeSpent > 0) {
      fetch(API_ENDPOINT + '/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          sessionId: sessionId,
          pageUrl: currentPageUrl,
          timeSpent: timeSpent,
          apiKey: API_KEY
        }),
        keepalive: true
      }).catch(function(error) {
        // Silently fail for time updates
      });
    }
  }

  /**
   * Track a new pageview
   */
  function trackPageview(url, title) {
    url = url || getActualUrl();
    title = title || getActualTitle();

    // Update time spent on previous page
    if (sequenceNumber > 0) {
      updateTimeSpent();
    }

    // Increment sequence number
    sequenceNumber++;
    saveSequenceNumber(sequenceNumber);

    // Use session referrer for all pages in the session
    // This ensures consistent traffic source attribution across the entire journey
    var referrerToSend = sessionReferrer || null;

    // Send tracking data
    sendTrackingData({
      pageUrl: url,
      pageTitle: title,
      sequenceNumber: sequenceNumber,
      timeSpent: 0,
      referrer: referrerToSend,
      retryCount: 0
    });

    // Update state
    lastUrl = url;
    currentPageUrl = url;
    pageStartTime = Date.now();
  }

  /**
   * Handle page unload - send final time update
   */
  function handleUnload() {
    updateTimeSpent();
    stopHeartbeat();
  }

  /**
   * Start heartbeat to periodically update time spent
   */
  function startHeartbeat() {
    // Update time every 30 seconds
    heartbeatInterval = setInterval(updateTimeSpent, 30000);
  }

  /**
   * Stop heartbeat
   */
  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  /**
   * Detect SPA navigation (History API)
   */
  function setupSPATracking() {
    // Track history pushState
    var originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      handleUrlChange();
    };

    // Track history replaceState
    var originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      handleUrlChange();
    };

    // Track back/forward button
    window.addEventListener('popstate', handleUrlChange);
  }

  /**
   * Handle URL change in SPA
   */
  function handleUrlChange() {
    var newUrl = getActualUrl();
    if (newUrl !== currentPageUrl) {
      // Small delay to allow page title to update
      setTimeout(function() {
        trackPageview(newUrl, getActualTitle());
      }, 100);
    }
  }

  /**
   * Initialize tracking
   */
  function init() {
    // Track initial pageview
    trackPageview();

    // Start heartbeat
    startHeartbeat();

    // Setup SPA tracking
    setupSPATracking();

    // Track page unload
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    // Track page visibility changes
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        updateTimeSpent();
      }
    });

    console.log('Sunburst Analytics initialized');
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.SunburstAnalytics = {
    trackPageview: trackPageview,
    setApiKey: function(key) {
      API_KEY = key;
    },
    setEndpoint: function(endpoint) {
      API_ENDPOINT = endpoint;
    }
  };

})();
