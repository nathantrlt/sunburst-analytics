const { pool } = require('../config/database');

class PageCategory {
  // Create a new category rule
  static async create(clientId, name, conditionType, conditionValue, priority = 0, conditionPeriodDays = null, conditionsJson = null, cartographyId = null) {
    try {
      // Ensure conditionsJson is properly stringified
      let conditionsJsonStr = null;
      if (conditionsJson) {
        conditionsJsonStr = typeof conditionsJson === 'string' ? conditionsJson : JSON.stringify(conditionsJson);
      }

      const [result] = await pool.query(
        'INSERT INTO page_categories (client_id, cartography_id, name, condition_type, condition_value, priority, condition_period_days, conditions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [clientId, cartographyId, name, conditionType, conditionValue, priority, conditionPeriodDays, conditionsJsonStr]
      );
      return result.insertId;
    } catch (error) {
      console.error('PageCategory.create error:', error);
      throw error;
    }
  }

  // Get all category rules for a client (legacy - without cartography filter)
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

  // Get all category rules for a specific cartography
  static async findByCartographyId(cartographyId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM page_categories WHERE cartography_id = ? ORDER BY priority DESC, id ASC',
        [cartographyId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Get a single category rule
  static async findById(id, clientId = null) {
    try {
      let query = 'SELECT * FROM page_categories WHERE id = ?';
      const params = [id];

      if (clientId !== null) {
        query += ' AND client_id = ?';
        params.push(clientId);
      }

      const [rows] = await pool.query(query, params);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Update a category rule
  static async update(id, clientId, name, conditionType, conditionValue, priority, conditionPeriodDays = null, conditionsJson = null) {
    try {
      // Ensure conditionsJson is properly stringified
      let conditionsJsonStr = null;
      if (conditionsJson) {
        conditionsJsonStr = typeof conditionsJson === 'string' ? conditionsJson : JSON.stringify(conditionsJson);
      }

      const [result] = await pool.query(
        'UPDATE page_categories SET name = ?, condition_type = ?, condition_value = ?, priority = ?, condition_period_days = ?, conditions_json = ? WHERE id = ? AND client_id = ?',
        [name, conditionType, conditionValue, priority, conditionPeriodDays, conditionsJsonStr, id, clientId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('PageCategory.update error:', error);
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
  static async applyCategoryRules(clientId, url, rules) {
    // Sort by priority (already sorted in query, but double-check)
    const sortedRules = [...rules].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.id - b.id;
    });

    for (const rule of sortedRules) {
      if (await this.matchesRule(clientId, url, rule)) {
        return rule.name;
      }
    }

    return 'Non catégorisé';
  }

  // Calculate metrics for a URL
  static async calculateUrlMetrics(clientId, url, periodDays = null) {
    try {
      let query = `
        SELECT
          COUNT(*) as total_views,
          AVG(sequence_number) as avg_position,
          AVG(time_spent) as avg_time_spent
        FROM pageviews
        WHERE client_id = ? AND page_url = ?
      `;
      const params = [clientId, url];

      if (periodDays) {
        query += ' AND DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
        params.push(periodDays);
      }

      const [rows] = await pool.query(query, params);
      return rows[0] || { total_views: 0, avg_position: 0, avg_time_spent: 0 };
    } catch (error) {
      console.error('Error calculating URL metrics:', error);
      return { total_views: 0, avg_position: 0, avg_time_spent: 0 };
    }
  }

  // Evaluate complex multi-condition rules
  static async evaluateConditions(clientId, url, conditions) {
    if (!conditions || !conditions.operator || !conditions.conditions) {
      console.log('Invalid conditions structure:', conditions);
      return false;
    }

    const { operator, conditions: conditionList } = conditions;
    console.log(`Evaluating ${conditionList.length} conditions with operator ${operator} for URL: ${url}`);
    const results = [];

    for (const condition of conditionList) {
      // If condition has nested conditions (recursive)
      if (condition.operator && condition.conditions) {
        const result = await this.evaluateConditions(clientId, url, condition);
        console.log(`Nested condition result: ${result}`);
        results.push(result);
      } else {
        // Evaluate single condition
        const result = await this.evaluateSingleCondition(clientId, url, condition);
        console.log(`Condition ${condition.type} "${condition.value}" result: ${result}`);
        results.push(result);
      }
    }

    // Apply operator
    const finalResult = operator === 'AND'
      ? results.every(r => r === true)
      : results.some(r => r === true);

    console.log(`Final result for ${operator} operation: ${finalResult} (individual results: ${results.join(', ')})`);
    return finalResult;
  }

  // Evaluate a single condition
  static async evaluateSingleCondition(clientId, url, condition) {
    const { type, value, period_days } = condition;

    try {
      // URL-based conditions
      switch (type) {
        case 'contains':
          return url.toLowerCase().includes(value.toLowerCase());

        case 'not_contains':
          return !url.toLowerCase().includes(value.toLowerCase());

        case 'starts_with':
          return url.toLowerCase().startsWith(value.toLowerCase());

        case 'ends_with':
          return url.toLowerCase().endsWith(value.toLowerCase());

        case 'equals':
          return url.toLowerCase() === value.toLowerCase();

        case 'regex':
          const regex = new RegExp(value, 'i');
          return regex.test(url);

        // Metric-based conditions
        case 'pageviews_greater_than':
        case 'pageviews_less_than':
        case 'avg_position_greater_than':
        case 'avg_position_less_than':
        case 'avg_time_greater_than':
        case 'avg_time_less_than':
          const metrics = await this.calculateUrlMetrics(clientId, url, period_days);
          const threshold = parseFloat(value);

          switch (type) {
            case 'pageviews_greater_than':
              return metrics.total_views > threshold;
            case 'pageviews_less_than':
              return metrics.total_views < threshold;
            case 'avg_position_greater_than':
              return metrics.avg_position > threshold;
            case 'avg_position_less_than':
              return metrics.avg_position < threshold;
            case 'avg_time_greater_than':
              return metrics.avg_time_spent > threshold;
            case 'avg_time_less_than':
              return metrics.avg_time_spent < threshold;
            default:
              return false;
          }

        default:
          return false;
      }
    } catch (error) {
      console.error('Error evaluating single condition:', error);
      return false;
    }
  }

  // Check if a URL matches a rule
  static async matchesRule(clientId, url, rule) {
    try {
      // If conditions_json exists, use multi-condition evaluation
      if (rule.conditions_json) {
        console.log(`Rule "${rule.name}" has conditions_json:`, rule.conditions_json);
        const conditions = typeof rule.conditions_json === 'string'
          ? JSON.parse(rule.conditions_json)
          : rule.conditions_json;
        console.log('Parsed conditions:', JSON.stringify(conditions, null, 2));
        return await this.evaluateConditions(clientId, url, conditions);
      }

      // Otherwise, use legacy single condition
      const { condition_type, condition_value, condition_period_days } = rule;
      // URL-based conditions (synchronous)
      switch (condition_type) {
        case 'contains':
          return url.toLowerCase().includes(condition_value.toLowerCase());

        case 'not_contains':
          return !url.toLowerCase().includes(condition_value.toLowerCase());

        case 'starts_with':
          return url.toLowerCase().startsWith(condition_value.toLowerCase());

        case 'ends_with':
          return url.toLowerCase().endsWith(condition_value.toLowerCase());

        case 'equals':
          return url.toLowerCase() === condition_value.toLowerCase();

        case 'regex':
          const regex = new RegExp(condition_value, 'i');
          return regex.test(url);

        // Metric-based conditions (asynchronous)
        case 'pageviews_greater_than':
        case 'pageviews_less_than':
        case 'avg_position_greater_than':
        case 'avg_position_less_than':
        case 'avg_time_greater_than':
        case 'avg_time_less_than':
          const metrics = await this.calculateUrlMetrics(clientId, url, condition_period_days);
          const threshold = parseFloat(condition_value);

          switch (condition_type) {
            case 'pageviews_greater_than':
              return metrics.total_views > threshold;
            case 'pageviews_less_than':
              return metrics.total_views < threshold;
            case 'avg_position_greater_than':
              return metrics.avg_position > threshold;
            case 'avg_position_less_than':
              return metrics.avg_position < threshold;
            case 'avg_time_greater_than':
              return metrics.avg_time_spent > threshold;
            case 'avg_time_less_than':
              return metrics.avg_time_spent < threshold;
            default:
              return false;
          }

        default:
          return false;
      }
    } catch (error) {
      // If regex is invalid or any other error, return false
      console.error('Error matching rule:', error);
      return false;
    }
  }

  // Get category statistics for a client (with optional cartography filter)
  static async getCategoryStats(clientId, filters = {}) {
    try {
      // First get all rules - use cartography-specific rules if cartographyId is provided
      let rules;
      if (filters.cartographyId) {
        rules = await this.findByCartographyId(filters.cartographyId);
      } else {
        rules = await this.findByClientId(clientId);
      }

      // Then get all pageviews with additional stats
      let query = `
        SELECT
          page_url,
          COUNT(*) as count,
          AVG(sequence_number) as avgDepth,
          AVG(time_spent) as avgTimeSpent
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
        query += require('./pageview').buildTrafficSourceCondition(filters.trafficSource);
      }

      query += ' GROUP BY page_url';

      const [pageviews] = await pool.query(query, params);

      // Apply rules to each URL and track which rule matched
      const categoryStats = {};
      const categoryIdMap = {}; // Map category name to first matching rule ID

      for (const pv of pageviews) {
        const matchingRule = await this.getMatchingRule(clientId, pv.page_url, rules);
        const categoryName = matchingRule ? matchingRule.name : 'Non catégorisé';

        // If category filter is set, only include matching category
        if (filters.category && categoryName !== filters.category) {
          continue;
        }

        if (!categoryStats[categoryName]) {
          categoryStats[categoryName] = {
            count: 0,
            totalDepth: 0,
            totalTime: 0,
            uniquePages: new Set(),
            viewsCount: 0
          };
          categoryIdMap[categoryName] = matchingRule ? matchingRule.id : null;
        }

        const count = parseInt(pv.count);
        categoryStats[categoryName].count += count;
        categoryStats[categoryName].totalDepth += (pv.avgDepth || 0) * count;
        categoryStats[categoryName].totalTime += (pv.avgTimeSpent || 0) * count;
        categoryStats[categoryName].uniquePages.add(pv.page_url);
        categoryStats[categoryName].viewsCount += count;
      }

      // Convert to array and sort by count
      return Object.entries(categoryStats)
        .map(([category, stats]) => ({
          id: categoryIdMap[category],
          category,
          count: stats.count,
          uniquePages: stats.uniquePages.size,
          avgDepth: stats.viewsCount > 0 ? stats.totalDepth / stats.viewsCount : 0,
          avgTimeSpent: stats.viewsCount > 0 ? stats.totalTime / stats.viewsCount : 0
        }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      throw error;
    }
  }

  // Get the matching rule for a URL (returns the rule object, not just the name)
  static async getMatchingRule(clientId, url, rules) {
    const sortedRules = [...rules].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.id - b.id;
    });

    for (const rule of sortedRules) {
      if (await this.matchesRule(clientId, url, rule)) {
        return rule;
      }
    }

    return null;
  }
}

module.exports = PageCategory;
