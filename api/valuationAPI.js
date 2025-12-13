/**
 * Valuation Requests API
 * Manages CRUD operations for valuation requests with Supabase
 */

const { createClient } = require('@supabase/supabase-js');

class ValuationAPI {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get all valuation requests with optional filters
   */
  async getValuations(filters = {}) {
    try {
      let query = this.supabase
        .from('valuation_requests')
        .select(
          `
          *,
          bankers (
            id,
            name,
            display_name,
            bank_name,
            agent_number,
            whatsapp_group_name
          )
        `
        )
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.banker_id) {
        query = query.eq('banker_id', filters.banker_id);
      }

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      if (filters.search) {
        query = query.or(
          `address.ilike.%${filters.search}%,salesperson_name.ilike.%${filters.search}%`
        );
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching valuations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get single valuation by ID
   */
  async getValuation(id) {
    try {
      const { data, error } = await this.supabase
        .from('valuation_requests')
        .select(
          `
          *,
          bankers (
            id,
            name,
            display_name,
            bank_name,
            agent_number,
            whatsapp_group_name
          )
        `
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching valuation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update valuation request
   */
  async updateValuation(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('valuation_requests')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error updating valuation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete valuation request
   */
  async deleteValuation(id) {
    try {
      const { error } = await this.supabase.from('valuation_requests').delete().eq('id', id);

      if (error) throw error;

      return {
        success: true,
        message: 'Valuation deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting valuation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get valuation statistics
   */
  async getStatistics(filters = {}) {
    try {
      let query = this.supabase.from('valuation_requests').select('status, banker_id, created_at');

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats = {
        total: data.length,
        by_status: {},
        by_banker: {},
        completion_rate: 0
      };

      // Calculate statistics
      data.forEach(valuation => {
        // By status
        stats.by_status[valuation.status] = (stats.by_status[valuation.status] || 0) + 1;

        // By banker
        if (valuation.banker_id) {
          stats.by_banker[valuation.banker_id] = (stats.by_banker[valuation.banker_id] || 0) + 1;
        }
      });

      // Completion rate
      const completed = stats.by_status['completed'] || 0;
      stats.completion_rate = data.length > 0 ? ((completed / data.length) * 100).toFixed(2) : 0;

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export valuations to CSV
   */
  async exportToCSV(filters = {}) {
    try {
      const result = await this.getValuations(filters);

      if (!result.success) {
        throw new Error(result.error);
      }

      const data = result.data;

      if (data.length === 0) {
        return {
          success: true,
          csv: 'No data to export'
        };
      }

      // Generate CSV headers
      const headers = [
        'ID',
        'Created At',
        'Status',
        'Address',
        'Size',
        'Asking',
        'Salesperson',
        'Agent Number',
        'Banker',
        'Bank',
        'Forwarded',
        'Acknowledged',
        'Replied',
        'Completed'
      ];

      // Generate CSV rows
      const rows = data.map(val => [
        val.id,
        new Date(val.created_at).toLocaleString(),
        val.status,
        val.address || '',
        val.size || '',
        val.asking || '',
        val.salesperson_name || '',
        val.agent_number || '',
        val.bankers?.name || '',
        val.bankers?.bank_name || '',
        val.forwarded_to_banker ? 'Yes' : 'No',
        val.acknowledgment_sent ? 'Yes' : 'No',
        val.banker_replied_at ? 'Yes' : 'No',
        val.completed_at ? 'Yes' : 'No'
      ]);

      // Combine headers and rows
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return {
        success: true,
        csv,
        filename: `valuations_export_${new Date().toISOString().split('T')[0]}.csv`
      };
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ValuationAPI;
