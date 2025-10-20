const { pool } = require('../config/database');

class PageCategory {
  // Create a new category rule
  static async create(clientId, name, conditionType, conditionValue, priority = 0) {
    try {
      const [result] = await pool.query(
        'INSERT INTO page_categories (client_id, name, condition_type, condition_value, priority) VALUES (?, ?, ?, ?, ?)',
        [clientId, name, conditionType, conditionValue, priority]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  // Get all category rules for a client
  static async findByClientId(clientId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM page_categories WHERE client_id = ? ORDER BY priority DESC, id ASC',
        [clientId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Get a single category rule
  static async findById(id, clientId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM page_categories WHERE id = ? AND client_id = ?',
        [id, clientId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Update a category rule
  static async update(id, clientId, name, conditionType, conditionValue, priority) {
    try {
      const [result] = await pool.query(
        'UPDATE page_categories SET name = ?, condition_type = ?, condition_value = ?, priority = ? WHERE id = ? AND client_id = ?',
        [name, conditionType, conditionValue, priority, id, clientId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // Delete a category rule
  static async delete(id, clientId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM page_categories WHERE id = ? AND client_id = ?',
        [id, clientId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // Apply category rules to a URL
  static applyCategoryRules(url, rules) {
    // Sort by priority (already sorted in query, but double-check)
    const sortedRules = [...rules].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.id - b.id;
    });

    for (const rule of sortedRules) {
      if (this.matchesRule(url, rule)) {
        return rule.name;
      }
    }

    return 'Uncategorized';
  }

  // Check if a URL matches a rule
  static matchesRule(url, rule) {
    const { condition_type, condition_value } = rule;

    try {
      switch (condition_type) {
        case 'contains':
          return url.toLowerCase().includes(condition_value.toLowerCase());

        case 'starts_with':
          return url.toLowerCase().startsWith(condition_value.toLowerCase());

        case 'ends_with':
          return url.toLowerCase().endsWith(condition_value.toLowerCase());

        case 'equals':
          return url.toLowerCase() === condition_value.toLowerCase();

        case 'regex':
          const regex = new RegExp(condition_value, 'i');
          return regex.test(url);

        default:
          return false;
      }
    } catch (error) {
      // If regex is invalid or any other error, return false
      console.error('Error matching rule:', error);
      return false;
    }
  }

  // Get category statistics for a client
  static async getCategoryStats(clientId, startDate = null, endDate = null) {
    try {
      // First get all rules
      const rules = await this.findByClientId(clientId);

      // Then get all pageviews
      let query = `
        SELECT page_url, COUNT(*) as count
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

      query += ' GROUP BY page_url';

      const [pageviews] = await pool.query(query, params);

      // Apply rules to each URL
      const categoryStats = {};

      pageviews.forEach(pv => {
        const category = this.applyCategoryRules(pv.page_url, rules);
        if (!categoryStats[category]) {
          categoryStats[category] = 0;
        }
        categoryStats[category] += parseInt(pv.count);
      });

      // Convert to array and sort by count
      return Object.entries(categoryStats)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = PageCategory;
