/**
 * Banker Management API
 * Manages CRUD operations for bankers with Supabase
 */

const { createClient } = require('@supabase/supabase-js');

class BankerAPI {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get all bankers with optional filters
   */
  async getBankers(filters = {}) {
    try {
      let query = this.supabase
        .from('bankers')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      // Apply filters
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters.bank_name) {
        query = query.eq('bank_name', filters.bank_name);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%,bank_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      console.error('Error fetching bankers:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get single banker by ID
   */
  async getBanker(id) {
    try {
      const { data, error } = await this.supabase
        .from('bankers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error fetching banker:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create new banker
   */
  async createBanker(bankerData) {
    try {
      // Validate required fields
      if (!bankerData.name || !bankerData.display_name || !bankerData.whatsapp_group_id) {
        throw new Error('Missing required fields: name, display_name, whatsapp_group_id');
      }

      const { data, error } = await this.supabase
        .from('bankers')
        .insert({
          name: bankerData.name,
          display_name: bankerData.display_name,
          agent_number: bankerData.agent_number || null,
          bank_name: bankerData.bank_name || null,
          organization: bankerData.organization || null,
          whatsapp_group_id: bankerData.whatsapp_group_id,
          whatsapp_group_name: bankerData.whatsapp_group_name || null,
          routing_keywords: bankerData.routing_keywords || [],
          is_active: bankerData.is_active !== undefined ? bankerData.is_active : true,
          priority: bankerData.priority || 0,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error creating banker:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update banker
   */
  async updateBanker(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('bankers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error updating banker:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete banker
   */
  async deleteBanker(id) {
    try {
      const { error } = await this.supabase
        .from('bankers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return {
        success: true,
        message: 'Banker deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting banker:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Toggle banker active status
   */
  async toggleActive(id, isActive) {
    try {
      const { data, error } = await this.supabase
        .from('bankers')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error toggling banker status:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get banker statistics
   */
  async getBankerStatistics(id) {
    try {
      // Get banker info
      const { data: banker, error: bankerError } = await this.supabase
        .from('bankers')
        .select('*')
        .eq('id', id)
        .single();

      if (bankerError) throw bankerError;

      // Get valuations for this banker
      const { data: valuations, error: valuationsError } = await this.supabase
        .from('valuation_requests')
        .select('status, created_at, completed_at')
        .eq('banker_id', id);

      if (valuationsError) throw valuationsError;

      const stats = {
        banker: banker,
        total_valuations: valuations.length,
        by_status: {},
        avg_response_time: null,
      };

      // Calculate statistics
      let totalResponseTime = 0;
      let completedCount = 0;

      valuations.forEach(val => {
        // By status
        stats.by_status[val.status] = (stats.by_status[val.status] || 0) + 1;

        // Response time
        if (val.completed_at && val.created_at) {
          const responseTime = new Date(val.completed_at) - new Date(val.created_at);
          totalResponseTime += responseTime;
          completedCount++;
        }
      });

      // Average response time in minutes
      if (completedCount > 0) {
        stats.avg_response_time = Math.round(totalResponseTime / completedCount / 1000 / 60);
      }

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error fetching banker statistics:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get available bank names
   */
  async getBankNames() {
    try {
      const { data, error } = await this.supabase
        .from('bankers')
        .select('bank_name')
        .not('bank_name', 'is', null);

      if (error) throw error;

      const bankNames = [...new Set(data.map(b => b.bank_name))].filter(Boolean);

      return {
        success: true,
        data: bankNames.sort(),
      };
    } catch (error) {
      console.error('Error fetching bank names:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = BankerAPI;
