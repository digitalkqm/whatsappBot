const { createClient } = require('@supabase/supabase-js');

// Workflow execution engine
class WorkflowEngine {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.activeWorkflows = new Map();
    this.workflowHandlers = new Map();
    this.client = null; // WhatsApp client will be set by index.js
    this.messageQueue = null; // Message send queue will be set by index.js
  }

  // Set WhatsApp client (called from index.js after client is initialized)
  setClient(client) {
    this.client = client;
    console.log('✅ WorkflowEngine: WhatsApp client set');
  }

  // Set message send queue (called from index.js after queue is initialized)
  setMessageQueue(queue) {
    this.messageQueue = queue;
    console.log('✅ WorkflowEngine: Message send queue set');
  }

  // Register a workflow handler
  registerWorkflow(name, handler) {
    this.workflowHandlers.set(name, handler);
    console.log(`✅ Registered workflow: ${name}`);
  }

  // Execute a workflow
  async executeWorkflow(workflowName, payload) {
    const handler = this.workflowHandlers.get(workflowName);

    if (!handler) {
      throw new Error(`Workflow "${workflowName}" not found`);
    }

    const executionId = `${workflowName}_${Date.now()}`;

    try {
      console.log(`🚀 Starting workflow: ${workflowName} (${executionId})`);

      this.activeWorkflows.set(executionId, {
        name: workflowName,
        status: 'running',
        startedAt: new Date().toISOString(),
        payload
      });

      const result = await handler(payload, this);

      this.activeWorkflows.set(executionId, {
        name: workflowName,
        status: 'completed',
        startedAt: this.activeWorkflows.get(executionId).startedAt,
        completedAt: new Date().toISOString(),
        result
      });

      console.log(`✅ Workflow completed: ${workflowName} (${executionId})`);
      return result;

    } catch (error) {
      console.error(`❌ Workflow failed: ${workflowName} (${executionId})`, error);

      this.activeWorkflows.set(executionId, {
        name: workflowName,
        status: 'failed',
        startedAt: this.activeWorkflows.get(executionId).startedAt,
        failedAt: new Date().toISOString(),
        error: error.message
      });

      throw error;
    }
  }

  // Get workflow state
  async getWorkflowState(workflowName, key) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_state')
        .select('value')
        .eq('workflow_name', workflowName)
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data?.value;
    } catch (err) {
      console.error(`Error getting workflow state: ${err.message}`);
      return null;
    }
  }

  // Set workflow state
  async setWorkflowState(workflowName, key, value) {
    try {
      const { error } = await this.supabase
        .from('workflow_state')
        .upsert({
          workflow_name: workflowName,
          key,
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workflow_name,key'
        });

      if (error) throw error;

    } catch (err) {
      console.error(`Error setting workflow state: ${err.message}`);
      throw err;
    }
  }

  // Get active workflows
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values());
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WorkflowEngine;
