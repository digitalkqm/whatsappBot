const { createClient } = require('@supabase/supabase-js');

class WorkflowAPI {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Create a new workflow
  async createWorkflow(workflowData) {
    try {
      const { name, description, trigger_type, trigger_config, workflow_data, is_active } = workflowData;

      // Validate required fields
      if (!name || !trigger_type || !workflow_data) {
        throw new Error('Missing required fields: name, trigger_type, workflow_data');
      }

      // Validate workflow structure
      this.validateWorkflowData(workflow_data);

      const { data, error } = await this.supabase
        .from('workflows')
        .insert({
          name,
          description: description || null,
          trigger_type,
          trigger_config: trigger_config || {},
          workflow_data,
          is_active: is_active !== undefined ? is_active : true,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Workflow created: ${name} (${data.id})`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error creating workflow:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get all workflows
  async getWorkflows(filters = {}) {
    try {
      let query = this.supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters.trigger_type) {
        query = query.eq('trigger_type', filters.trigger_type);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error getting workflows:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get workflow by ID
  async getWorkflow(id) {
    try {
      const { data, error } = await this.supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error getting workflow:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update workflow
  async updateWorkflow(id, updates) {
    try {
      // Validate workflow data if provided
      if (updates.workflow_data) {
        this.validateWorkflowData(updates.workflow_data);
      }

      const { data, error } = await this.supabase
        .from('workflows')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Workflow updated: ${id}`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error updating workflow:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete workflow
  async deleteWorkflow(id) {
    try {
      const { error } = await this.supabase
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log(`✅ Workflow deleted: ${id}`);
      return { success: true, message: 'Workflow deleted successfully' };

    } catch (error) {
      console.error('❌ Error deleting workflow:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Toggle workflow active status
  async toggleWorkflow(id, is_active) {
    try {
      const { data, error } = await this.supabase
        .from('workflows')
        .update({
          is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Workflow ${is_active ? 'activated' : 'deactivated'}: ${id}`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error toggling workflow:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Duplicate workflow
  async duplicateWorkflow(id, newName) {
    try {
      // Get original workflow
      const { data: original, error: getError } = await this.supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (getError) throw getError;

      // Create duplicate
      const { data, error } = await this.supabase
        .from('workflows')
        .insert({
          name: newName || `${original.name} (Copy)`,
          description: original.description,
          trigger_type: original.trigger_type,
          trigger_config: original.trigger_config,
          workflow_data: original.workflow_data,
          is_active: false, // Start as inactive
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Workflow duplicated: ${id} → ${data.id}`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error duplicating workflow:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Validate workflow data structure
  validateWorkflowData(workflowData) {
    if (!workflowData || typeof workflowData !== 'object') {
      throw new Error('Invalid workflow data structure');
    }

    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      throw new Error('Workflow must contain a nodes array');
    }

    if (!workflowData.connections || !Array.isArray(workflowData.connections)) {
      throw new Error('Workflow must contain a connections array');
    }

    // Validate each node has required fields
    for (const node of workflowData.nodes) {
      if (!node.id || !node.type) {
        throw new Error('Each node must have an id and type');
      }
    }

    // Validate connections reference existing nodes
    const nodeIds = new Set(workflowData.nodes.map(n => n.id));
    for (const conn of workflowData.connections) {
      if (!nodeIds.has(conn.source) || !nodeIds.has(conn.target)) {
        throw new Error(`Invalid connection: ${conn.source} → ${conn.target}`);
      }
    }

    return true;
  }

  // Get workflow execution history
  async getExecutionHistory(workflowId, limit = 50) {
    try {
      let query = this.supabase
        .from('workflow_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (workflowId) {
        query = query.eq('workflow_id', workflowId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error getting execution history:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Create execution record
  async createExecution(workflowId, triggerData) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          status: 'pending',
          trigger_data: triggerData || {},
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error creating execution record:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update execution status
  async updateExecution(executionId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_executions')
        .update(updates)
        .eq('id', executionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error updating execution:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WorkflowAPI;
