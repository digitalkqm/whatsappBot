const { createClient } = require('@supabase/supabase-js');

class TemplateAPI {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Create a new template
  async createTemplate(templateData) {
    try {
      const { name, category, content, variables, image_url, metadata } = templateData;

      // Validate required fields
      if (!name || !content) {
        throw new Error('Missing required fields: name, content');
      }

      // Extract variables from content if not provided
      const extractedVars = variables || this.extractVariables(content);

      const { data, error } = await this.supabase
        .from('message_templates')
        .insert({
          name,
          category: category || 'general',
          content,
          variables: extractedVars,
          image_url: image_url || null,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Template created: ${name} (${data.id})`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error creating template:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get all templates
  async getTemplates(filters = {}) {
    try {
      let query = this.supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error getting templates:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get template by ID
  async getTemplate(id) {
    try {
      const { data, error } = await this.supabase
        .from('message_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error getting template:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update template
  async updateTemplate(id, updates) {
    try {
      // Re-extract variables if content was updated
      if (updates.content && !updates.variables) {
        updates.variables = this.extractVariables(updates.content);
      }

      const { data, error } = await this.supabase
        .from('message_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Template updated: ${id}`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error updating template:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete template
  async deleteTemplate(id) {
    try {
      const { error } = await this.supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log(`✅ Template deleted: ${id}`);
      return { success: true, message: 'Template deleted successfully' };

    } catch (error) {
      console.error('❌ Error deleting template:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Duplicate template
  async duplicateTemplate(id, newName) {
    try {
      // Get original template
      const { data: original, error: getError } = await this.supabase
        .from('message_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (getError) throw getError;

      // Create duplicate
      const { data, error } = await this.supabase
        .from('message_templates')
        .insert({
          name: newName || `${original.name} (Copy)`,
          category: original.category,
          content: original.content,
          variables: original.variables,
          image_url: original.image_url,
          metadata: original.metadata,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Template duplicated: ${id} → ${data.id}`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error duplicating template:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get template categories
  async getCategories() {
    try {
      const { data, error } = await this.supabase
        .from('message_templates')
        .select('category')
        .order('category');

      if (error) throw error;

      // Get unique categories
      const categories = [...new Set(data.map(item => item.category))].filter(Boolean);

      return { success: true, data: categories };

    } catch (error) {
      console.error('❌ Error getting categories:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Render template with data
  renderTemplate(template, data) {
    try {
      let rendered = template.content;

      // Replace all {{variable}} placeholders
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(regex, value || '');
      }

      // Check for unreplaced variables
      const unreplaced = rendered.match(/{{[^}]+}}/g);
      if (unreplaced) {
        console.warn(`⚠️ Unreplaced variables in template: ${unreplaced.join(', ')}`);
      }

      return {
        success: true,
        data: {
          content: rendered,
          image_url: template.image_url,
          unreplaced_variables: unreplaced || []
        }
      };

    } catch (error) {
      console.error('❌ Error rendering template:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Extract variables from template content
  extractVariables(content) {
    if (!content) return [];

    const matches = content.match(/{{([^}]+)}}/g);
    if (!matches) return [];

    // Extract variable names and remove duplicates
    const variables = matches.map(match => match.replace(/[{}]/g, '').trim());
    return [...new Set(variables)];
  }

  // Validate template
  validateTemplate(templateData) {
    const errors = [];

    if (!templateData.name || templateData.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!templateData.content || templateData.content.trim().length === 0) {
      errors.push('Template content is required');
    }

    if (templateData.content && templateData.content.length > 4096) {
      errors.push('Template content exceeds maximum length (4096 characters)');
    }

    if (templateData.image_url) {
      try {
        new URL(templateData.image_url);
      } catch (e) {
        errors.push('Invalid image URL');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Preview template with sample data
  async previewTemplate(id, sampleData = {}) {
    try {
      const { data: template, error } = await this.supabase
        .from('message_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Use sample data or generate defaults
      const defaultSampleData = {};
      for (const variable of template.variables) {
        defaultSampleData[variable] = sampleData[variable] || `[${variable}]`;
      }

      return this.renderTemplate(template, { ...defaultSampleData, ...sampleData });

    } catch (error) {
      console.error('❌ Error previewing template:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = TemplateAPI;
