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
  static async getStats(clientId, startDate = null, endDate = null) {
    try {
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

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      const [rows] = await pool.query(query, params);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get journey data for sunburst visualization
  static async getJourneyData(clientId, depth = 5, startDate = null, endDate = null) {
    try {
      let query = `
        SELECT
          session_id,
          page_url,
          page_title,
          sequence_number
        FROM pageviews
        WHERE client_id = ? AND sequence_number <= ?
      `;
      const params = [clientId, depth];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY session_id, sequence_number ASC';

      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Get page position statistics
  static async getPagePositions(clientId, startDate = null, endDate = null) {
    try {
      let query = `
        SELECT
          page_url,
          page_title,
          COUNT(*) as total_views,
          AVG(sequence_number) as avg_position,
          AVG(time_spent) as avg_time_spent
        FROM pageviews
        WHERE client_id = ?
      `;
      const params = [clientId];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY page_url, page_title ORDER BY total_views DESC';

      const [rows] = await pool.query(query, params);
      return rows;
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
}

module.exports = Pageview;
