const { pool } = require('../config/database');

class Pageview {
  // Create a new pageview
  static async create(data) {
    try {
      const {
        clientId,
        sessionId,
        userIdentifier,
        pageUrl,
        pageTitle,
        sequenceNumber,
        timeSpent,
        deviceType,
        userLocation,
        referrer
      } = data;

      const [result] = await pool.query(
        `INSERT INTO pageviews
        (client_id, session_id, user_identifier, page_url, page_title, sequence_number,
         time_spent, device_type, user_location, referrer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, sessionId, userIdentifier, pageUrl, pageTitle, sequenceNumber,
         timeSpent || 0, deviceType, userLocation, referrer]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  // Get all pageviews for a client with date filter
  static async findByClientId(clientId, startDate = null, endDate = null) {
    try {
      let query = 'SELECT * FROM pageviews WHERE client_id = ?';
      const params = [clientId];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY timestamp ASC';

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Get general statistics for a client
  static async getStats(clientId, filters = {}) {
    try {
      // If category filter is set, we need to filter differently
      if (filters.category) {
        return await this.getStatsByCategory(clientId, filters);
      }

      let query = `
        SELECT
          COUNT(*) as total_pageviews,
          COUNT(DISTINCT session_id) as unique_sessions,
          COUNT(DISTINCT user_identifier) as unique_users,
          AVG(time_spent) as avg_time_spent,
          AVG(sequence_number) as avg_pages_per_session
        FROM pageviews
        WHERE client_id = ?
      `;
      const params = [clientId];

      if (filters.startDate) {
        query += ' AND DATE(timestamp) >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND DATE(timestamp) <= ?';
        params.push(filters.endDate);
      }

      if (filters.deviceType) {
        query += ' AND device_type = ?';
        params.push(filters.deviceType);
      }

      if (filters.trafficSource) {
        query += this.buildTrafficSourceCondition(filters.trafficSource);
      }

      const [rows] = await pool.query(query, params);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get statistics filtered by category
  static async getStatsByCategory(clientId, filters) {
    const pageviews = await this.getAllPageviews(clientId, filters);

    const uniqueSessions = new Set();
    const uniqueUsers = new Set();
    let totalTimeSpent = 0;
    let totalSequenceNumber = 0;

    pageviews.forEach(pv => {
      uniqueSessions.add(pv.session_id);
      uniqueUsers.add(pv.user_identifier);
      totalTimeSpent += pv.time_spent || 0;
      totalSequenceNumber += pv.sequence_number || 0;
    });

    return {
      total_pageviews: pageviews.length,
      unique_sessions: uniqueSessions.size,
      unique_users: uniqueUsers.size,
      avg_time_spent: pageviews.length > 0 ? totalTimeSpent / pageviews.length : 0,
      avg_pages_per_session: pageviews.length > 0 ? totalSequenceNumber / pageviews.length : 0
    };
  }

  // Helper to build traffic source condition
  static buildTrafficSourceCondition(trafficSource) {
    switch (trafficSource) {
      case 'direct':
        return " AND (referrer IS NULL OR referrer = '')";
      case 'search':
        return " AND (referrer LIKE '%google.%' OR referrer LIKE '%bing.%' OR referrer LIKE '%yahoo.%' OR referrer LIKE '%duckduckgo.%' OR referrer LIKE '%baidu.%')";
      case 'social':
        return " AND (referrer LIKE '%facebook.%' OR referrer LIKE '%twitter.%' OR referrer LIKE '%instagram.%' OR referrer LIKE '%linkedin.%' OR referrer LIKE '%pinterest.%' OR referrer LIKE '%tiktok.%' OR referrer LIKE '%youtube.%')";
      case 'referral':
        return " AND referrer IS NOT NULL AND referrer != '' AND referrer NOT LIKE '%google.%' AND referrer NOT LIKE '%bing.%' AND referrer NOT LIKE '%yahoo.%' AND referrer NOT LIKE '%facebook.%' AND referrer NOT LIKE '%twitter.%' AND referrer NOT LIKE '%instagram.%' AND referrer NOT LIKE '%linkedin.%'";
      default:
        return '';
    }
  }

  // Get journey data for sunburst visualization
  static async getJourneyData(clientId, depth = 5, filters = {}) {
    try {
      let query = `
        SELECT
          p.session_id,
          p.page_url,
          p.page_title,
          p.sequence_number,
          NOT EXISTS (
            SELECT 1 FROM pageviews p2
            WHERE p2.session_id = p.session_id
            AND p2.sequence_number > p.sequence_number
          ) as is_last_page
        FROM pageviews p
        WHERE p.client_id = ? AND p.sequence_number <= ?
      `;
      const params = [clientId, depth];

      if (filters.startDate) {
        query += ' AND DATE(p.timestamp) >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND DATE(p.timestamp) <= ?';
        params.push(filters.endDate);
      }

      if (filters.deviceType) {
        query += ' AND p.device_type = ?';
        params.push(filters.deviceType);
      }

      if (filters.trafficSource) {
        query += this.buildTrafficSourceCondition(filters.trafficSource).replace(/referrer/g, 'p.referrer');
      }

      query += ' ORDER BY p.session_id, p.sequence_number ASC';

      const [rows] = await pool.query(query, params);

      // Apply category filter if specified
      if (filters.category) {
        return await this.filterByCategory(rows, clientId, filters.category);
      }

      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Get page position statistics
  static async getPagePositions(clientId, filters = {}) {
    try {
      let query = `
        SELECT
          p.page_url,
          p.page_title,
          COUNT(*) as total_views,
          AVG(p.sequence_number) as avg_position,
          AVG(p.time_spent) as avg_time_spent,
          COALESCE(exits.exit_count, 0) as exit_count
        FROM pageviews p
        LEFT JOIN (
          SELECT page_url, COUNT(*) as exit_count
          FROM pageviews p1
          WHERE client_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM pageviews p2
            WHERE p2.session_id = p1.session_id
            AND p2.sequence_number > p1.sequence_number
          )
          GROUP BY page_url
        ) exits ON p.page_url = exits.page_url
        WHERE p.client_id = ?
      `;
      const params = [clientId, clientId];

      if (filters.startDate) {
        query += ' AND DATE(p.timestamp) >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND DATE(p.timestamp) <= ?';
        params.push(filters.endDate);
      }

      if (filters.deviceType) {
        query += ' AND p.device_type = ?';
        params.push(filters.deviceType);
      }

      if (filters.trafficSource) {
        query += this.buildTrafficSourceCondition(filters.trafficSource).replace(/referrer/g, 'p.referrer');
      }

      query += ' GROUP BY p.page_url, p.page_title, exits.exit_count ORDER BY total_views DESC';

      const [rows] = await pool.query(query, params);

      // Calculate exit rate percentage
      const rowsWithExitRate = rows.map(row => ({
        ...row,
        exit_rate: row.total_views > 0 ? ((row.exit_count / row.total_views) * 100).toFixed(1) : 0
      }));

      // Apply category filter if specified
      if (filters.category) {
        return await this.filterPageStatsByCategory(rowsWithExitRate, clientId, filters.category);
      }

      return rowsWithExitRate;
    } catch (error) {
      throw error;
    }
  }

  // Update time spent on a page
  static async updateTimeSpent(sessionId, pageUrl, timeSpent) {
    try {
      await pool.query(
        `UPDATE pageviews
         SET time_spent = ?
         WHERE session_id = ? AND page_url = ?
         ORDER BY timestamp DESC LIMIT 1`,
        [timeSpent, sessionId, pageUrl]
      );
    } catch (error) {
      throw error;
    }
  }

  // Get all pageviews for a client (for category filtering)
  static async getAllPageviews(clientId, filters = {}) {
    try {
      let query = `
        SELECT
          page_url,
          page_title,
          sequence_number,
          time_spent,
          session_id,
          user_identifier
        FROM pageviews
        WHERE client_id = ?
      `;
      const params = [clientId];

      if (filters.startDate) {
        query += ' AND DATE(timestamp) >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND DATE(timestamp) <= ?';
        params.push(filters.endDate);
      }

      if (filters.deviceType) {
        query += ' AND device_type = ?';
        params.push(filters.deviceType);
      }

      if (filters.trafficSource) {
        query += this.buildTrafficSourceCondition(filters.trafficSource);
      }

      const [rows] = await pool.query(query, params);

      // Apply category filter if specified
      if (filters.category) {
        return await this.filterByCategory(rows, clientId, filters.category);
      }

      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Helper to filter pageviews by category
  static async filterByCategory(pageviews, clientId, categoryName) {
    const PageCategory = require('./pageCategory');
    const rules = await PageCategory.findByClientId(clientId);

    const filtered = [];
    for (const pv of pageviews) {
      const matchingRule = await PageCategory.getMatchingRule(clientId, pv.page_url, rules);
      const pageCategory = matchingRule ? matchingRule.name : 'Non catégorisé';
      if (pageCategory === categoryName) {
        filtered.push(pv);
      }
    }
    return filtered;
  }

  // Helper to filter page stats by category
  static async filterPageStatsByCategory(pageStats, clientId, categoryName) {
    const PageCategory = require('./pageCategory');
    const rules = await PageCategory.findByClientId(clientId);

    const filtered = [];
    for (const page of pageStats) {
      const matchingRule = await PageCategory.getMatchingRule(clientId, page.page_url, rules);
      const pageCategory = matchingRule ? matchingRule.name : 'Non catégorisé';
      if (pageCategory === categoryName) {
        filtered.push(page);
      }
    }
    return filtered;
  }
}

module.exports = Pageview;
